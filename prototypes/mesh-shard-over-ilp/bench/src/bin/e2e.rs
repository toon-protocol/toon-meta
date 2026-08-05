//! END-TO-END: one paid ILP packet over a real BTP websocket to a REAL
//! compiled `connector` process, terminating at a real HTTP app, on loopback.
//!
//! This is the number the whole prototype exists to produce: the wall-clock
//! cost of one inter-shard crossing if the hop rides TOON's paid wire.
//!
//! Four configurations, so the payment layer's cost is isolated by
//! subtraction:
//!   A  price=0, no state_dir      -- free packet, no journal, no claim
//!   B  price=0, state_dir set     -- free packet, peer-wire journal armed
//!   C  price=100, state_dir set   -- PAID packet: claim signed, verified, fsync'd
//!   D  price=100, state_dir on tmpfs (if available) -- fsync on RAM-backed fs
//!
//! Usage: e2e [iters] [payload_bytes]

use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};
use std::time::Instant;

use chrono::{Duration as ChronoDuration, Utc};
use connector_domain::{derive_condition, EnvelopeRequest, Fulfill, Prepare, Reject};
use connector_signer::giftwrap::{derive_fulfillment, open_response, seal_request};
use connector_signer::{
    derive_evm_address, evm_balance_proof_digest, to_hex, EvmBalanceProof, LocalSigner,
    PublicKeyBytes, Signer,
};
use futures_util::{SinkExt, StreamExt};
use libsecp256k1::{Message as SecpMessage, PublicKey, SecretKey};
use tokio_tungstenite::tungstenite::Message as WsMessage;

const BTP_RESPONSE: u8 = 1;
const BTP_MESSAGE: u8 = 6;
const CLAIM_PROTOCOL: &str = "payment-channel-claim";
const EVM_CHAIN_ID: u64 = 8453;
const TOKEN_NETWORK: [u8; 20] = [0x42; 20];
const KEY_SEED: u8 = 7;
const CHANNEL_ID: &str = "0xabababababababababababababababababababababababababababababababab";

const CONNECTOR_BIN: &str = "/home/jonathan/Documents/connector/target/release/connector";
const STUB_APP_BIN: &str = "/home/jonathan/Documents/connector/target/release/stub-app";

fn hex_encode(b: &[u8]) -> String {
    b.iter().map(|x| format!("{x:02x}")).collect()
}

fn channel_id_bytes() -> [u8; 32] {
    let mut out = [0u8; 32];
    for (i, b) in out.iter_mut().enumerate() {
        *b = u8::from_str_radix(&CHANNEL_ID[2 + i * 2..4 + i * 2], 16).unwrap();
    }
    out
}

// ------------------------------------------------------------ BTP grammar

fn btp_message(request_id: u32, protocol_data: &[(&str, &[u8])], ilp: &[u8]) -> Vec<u8> {
    let mut out = vec![BTP_MESSAGE];
    out.extend_from_slice(&request_id.to_be_bytes());
    out.push(protocol_data.len() as u8);
    for (name, data) in protocol_data {
        out.push(name.len() as u8);
        out.extend_from_slice(name.as_bytes());
        out.extend_from_slice(&1u16.to_be_bytes());
        out.extend_from_slice(&(data.len() as u32).to_be_bytes());
        out.extend_from_slice(data);
    }
    out.extend_from_slice(&(ilp.len() as u32).to_be_bytes());
    out.extend_from_slice(ilp);
    out
}

fn parse_ilp(buf: &[u8]) -> (u8, Vec<u8>) {
    let frame_type = buf[0];
    if frame_type != BTP_RESPONSE {
        return (frame_type, buf[5..].to_vec());
    }
    let mut pos = 5;
    let count = usize::from(buf[pos]);
    pos += 1;
    for _ in 0..count {
        let name_len = usize::from(buf[pos]);
        pos += 1 + name_len + 2;
        let data_len =
            u32::from_be_bytes([buf[pos], buf[pos + 1], buf[pos + 2], buf[pos + 3]]) as usize;
        pos += 4 + data_len;
    }
    let ilp_len = u32::from_be_bytes([buf[pos], buf[pos + 1], buf[pos + 2], buf[pos + 3]]) as usize;
    pos += 4;
    (frame_type, buf[pos..pos + ilp_len].to_vec())
}

// ----------------------------------------------------------------- claims

fn signed_claim_json(secret: &SecretKey, nonce: u64, amount: u64) -> String {
    let proof = EvmBalanceProof {
        channel_id: channel_id_bytes(),
        nonce,
        transferred_amount: u128::from(amount),
        locked_amount: 0,
        locks_root: [0u8; 32],
        chain_id: EVM_CHAIN_ID,
        token_network_address: TOKEN_NETWORK,
    };
    let m = SecpMessage::parse(&evm_balance_proof_digest(&proof));
    let (sig, rec) = libsecp256k1::sign(&m, secret);
    let mut sig_bytes = sig.serialize().to_vec();
    let rb: u8 = rec.into();
    sig_bytes.push(rb + 27);
    let address = derive_evm_address(&PublicKey::from_secret_key(secret).serialize());
    format!(
        r#"{{"version":"1.0","blockchain":"evm","messageId":"m{nonce}","timestamp":"2026-02-02T12:00:00.000Z","senderId":"bench","channelId":"{CHANNEL_ID}","nonce":{nonce},"transferredAmount":"{amount}","lockedAmount":"0","locksRoot":"0x{z}","signature":"0x{s}","signerAddress":"{a}","chainId":{EVM_CHAIN_ID},"tokenNetworkAddress":"{tn}"}}"#,
        z = "0".repeat(64),
        s = hex_encode(&sig_bytes),
        a = to_hex(&address),
        tn = to_hex(&TOKEN_NETWORK),
    )
}

// ---------------------------------------------------------------- process

struct Proc(Child);
impl Drop for Proc {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}

fn spawn_stub_app() -> (Proc, String) {
    let mut child = Command::new(STUB_APP_BIN)
        .arg("127.0.0.1:0")
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .expect("spawn stub-app (build it: cargo build --release --bin stub-app)");
    let mut out = BufReader::new(child.stdout.take().unwrap());
    let mut line = String::new();
    loop {
        line.clear();
        assert!(out.read_line(&mut line).unwrap() > 0, "stub-app died");
        if let Some(a) = line.trim().strip_prefix("stub-app listening ") {
            let addr = a.to_string();
            return (Proc(child), addr);
        }
    }
}

fn spawn_connector(config: &str) -> (Proc, String, tempfile::NamedTempFile) {
    let mut cfg = tempfile::NamedTempFile::new().unwrap();
    write!(cfg, "{config}").unwrap();
    cfg.flush().unwrap();
    let mut child = Command::new(CONNECTOR_BIN)
        .arg(cfg.path())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("spawn connector");
    let mut out = BufReader::new(child.stdout.take().unwrap());
    let mut line = String::new();
    loop {
        line.clear();
        if out.read_line(&mut line).unwrap() == 0 {
            let mut err = String::new();
            if let Some(mut e) = child.stderr.take() {
                use std::io::Read;
                let _ = e.read_to_string(&mut err);
            }
            panic!("connector exited before listening:\nCONFIG:\n{config}\nSTDERR:\n{err}");
        }
        if line.contains("connector listening") {
            let v: serde_json_lite::Value = serde_json_lite::parse(&line);
            return (Proc(child), v.addr, cfg);
        }
    }
}

/// Minimal extraction of `fields.addr` from a tracing-json log line -- avoids
/// pulling serde_json in just for this.
mod serde_json_lite {
    pub struct Value {
        pub addr: String,
    }
    pub fn parse(line: &str) -> Value {
        let key = "\"addr\":\"";
        let start = line.find(key).expect("addr field in log line") + key.len();
        let end = start + line[start..].find('"').unwrap();
        Value {
            addr: line[start..end].to_string(),
        }
    }
}

/// Control: a bare websocket echo round trip, same tokio + tungstenite +
/// loopback TCP as the connector's client edge, with no connector in it.
/// Whatever tail this shows is the floor the connector cannot be blamed for.
async fn ws_echo(size: usize, iters: u64) -> Vec<f64> {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        while let Ok((stream, _)) = listener.accept().await {
            tokio::spawn(async move {
                let mut ws = tokio_tungstenite::accept_async(stream).await.unwrap();
                while let Some(Ok(m)) = ws.next().await {
                    if let WsMessage::Binary(b) = m {
                        if ws.send(WsMessage::Binary(b)).await.is_err() {
                            break;
                        }
                    }
                }
            });
        }
    });
    let (mut ws, _) = tokio_tungstenite::connect_async(format!("ws://{addr}/"))
        .await
        .unwrap();
    let payload = vec![0x5au8; size];
    for _ in 0..200 {
        ws.send(WsMessage::Binary(payload.clone())).await.unwrap();
        let _ = ws.next().await.unwrap().unwrap();
    }
    let mut out = Vec::with_capacity(iters as usize);
    for _ in 0..iters {
        let t = Instant::now();
        ws.send(WsMessage::Binary(payload.clone())).await.unwrap();
        let _ = ws.next().await.unwrap().unwrap();
        out.push(t.elapsed().as_secs_f64() * 1_000_000.0);
    }
    out
}

// ------------------------------------------------------------------- run

fn stats(mut s: Vec<f64>) -> (f64, f64, f64, f64, f64) {
    s.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let n = s.len();
    let p = |q: f64| s[(((n as f64) * q / 100.0) as usize).min(n - 1)];
    let mean = s.iter().sum::<f64>() / n as f64;
    (p(50.0), p(90.0), p(99.0), mean, *s.last().unwrap())
}

/// Full distribution in ms, including p99.9 -- the tail percentile that
/// decides a sequential pipeline, where every crossing is on the critical
/// path and there is no slack to absorb a stall.
fn dist_line(label: &str, mut s: Vec<f64>) {
    s.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let n = s.len();
    let p = |q: f64| s[(((n as f64) * q / 100.0) as usize).min(n - 1)] / 1000.0;
    let mean = s.iter().sum::<f64>() / n as f64 / 1000.0;
    println!(
        "{label:<44} n={n:<7} p50={:>8.4} p90={:>8.4} p99={:>8.4} p99.9={:>8.4} max={:>9.4} mean={:>8.4}  (ms)",
        p(50.0), p(90.0), p(99.0), p(99.9), s[n-1]/1000.0, mean
    );
}

#[allow(clippy::too_many_arguments)]
async fn run_case(
    label: &str,
    price: u64,
    state_dir: Option<&std::path::Path>,
    payload: usize,
    iters: u64,
    key_file: &std::path::Path,
    identity: &PublicKeyBytes,
    secret: &SecretKey,
) -> Vec<f64> {
    let (_stub, stub_addr) = spawn_stub_app();
    let counterparty = to_hex(&derive_evm_address(
        &PublicKey::from_secret_key(secret).serialize(),
    ));

    let mut config = format!(
        "client_edge_addr = \"127.0.0.1:0\"\n{state}\n[signer]\nkey_file = \"{key}\"\n\n[[routes]]\nprefix = \"g.local.app\"\nhandler_url = \"http://{stub_addr}\"\nprice = {price}\n",
        state = state_dir
            .map(|d| format!("state_dir = \"{}\"", d.display()))
            .unwrap_or_default(),
        key = key_file.display(),
    );
    if price > 0 {
        config.push_str(&format!(
            "\n[[client_channels]]\nchannel_id = \"{CHANNEL_ID}\"\ncounterparty = \"{counterparty}\"\nchain_id = {EVM_CHAIN_ID}\ntoken_network_address = \"{}\"\n",
            to_hex(&TOKEN_NETWORK)
        ));
    }

    let (_conn, edge_addr, _cfg) = spawn_connector(&config);
    let (mut ws, _) = tokio_tungstenite::connect_async(format!("ws://{edge_addr}/ilp/btp"))
        .await
        .expect("btp upgrade");

    let body = vec![0xb7u8; payload];
    let mut samples = Vec::with_capacity(iters as usize);
    let mut ok = 0u64;
    let mut first_error: Option<String> = None;

    for i in 1..=iters {
        let plaintext = EnvelopeRequest {
            method: "POST".into(),
            target: "/".into(),
            headers: vec![],
            body: body.clone(),
        }
        .encode();
        let (sealed, secret_bytes) = seal_request(&plaintext, identity).unwrap();
        let prepare = Prepare {
            amount: price,
            expires_at: Utc::now() + ChronoDuration::minutes(5),
            execution_condition: derive_condition(&derive_fulfillment(&secret_bytes)),
            destination: "g.local.app".into(),
            data: sealed,
        };
        let claim = if price > 0 {
            Some(signed_claim_json(secret, i, i * price))
        } else {
            None
        };
        let ilp = prepare.encode();
        let frame = match &claim {
            Some(c) => btp_message(i as u32, &[(CLAIM_PROTOCOL, c.as_bytes())], &ilp),
            None => btp_message(i as u32, &[], &ilp),
        };

        let t = Instant::now();
        ws.send(WsMessage::Binary(frame)).await.unwrap();
        let reply = loop {
            match ws.next().await.expect("ws closed").unwrap() {
                WsMessage::Binary(b) => break b,
                _ => continue,
            }
        };
        let elapsed = t.elapsed().as_secs_f64() * 1_000_000.0;

        let (_ft, ilp_reply) = parse_ilp(&reply);
        if let Ok(f) = Fulfill::decode(&ilp_reply) {
            let _ = open_response(&secret_bytes, &f.data);
            ok += 1;
            // Only count fulfilled packets: a reject short-circuits before
            // the app and would flatter the number.
            samples.push(elapsed);
        } else if first_error.is_none() {
            first_error = Some(match Reject::decode(&ilp_reply) {
                Ok(r) => format!("REJECT {:?} {}", r.code, r.message),
                Err(_) => format!("unparseable reply, {} bytes", ilp_reply.len()),
            });
        }
    }

    if samples.is_empty() {
        println!("{label:<58} FAILED: {}", first_error.unwrap_or_default());
        return Vec::new();
    }
    let (p50, p90, p99, mean, max) = stats(samples.clone());
    println!(
        "{label:<58} n={:<5} fulfilled={ok}/{iters} p50={:>8.3}ms p90={:>8.3}ms p99={:>8.3}ms mean={:>8.3}ms max={:>9.3}ms",
        samples.len(),
        p50 / 1000.0,
        p90 / 1000.0,
        p99 / 1000.0,
        mean / 1000.0,
        max / 1000.0,
    );
    if let Some(e) = first_error {
        println!("    (first non-fulfil: {e})");
    }
    samples
}

#[tokio::main]
async fn main() {
    let mut args = std::env::args().skip(1);
    let iters: u64 = args
        .next()
        .and_then(|a| a.parse().ok())
        .unwrap_or(300);
    let payloads: Vec<usize> = {
        let rest: Vec<usize> = args.filter_map(|a| a.parse().ok()).collect();
        if rest.is_empty() {
            vec![1024, 16 * 1024, 32 * 1024, 64 * 1024]
        } else {
            rest
        }
    };

    let mut key_file = tempfile::NamedTempFile::new().unwrap();
    key_file.write_all(&[KEY_SEED; 32]).unwrap();
    key_file.flush().unwrap();
    let identity = LocalSigner::from_secret_bytes("id", [KEY_SEED; 32])
        .unwrap()
        .public_key()
        .unwrap();
    let secret = SecretKey::parse(&[9u8; 32]).unwrap();

    // ---- DIST MODE: high-n distribution of the IN-WINDOW (claimless) path
    // versus the paid path, at mesh-llm's real activation sizes, plus a raw
    // websocket echo control to separate connector-side tail from OS/tokio
    // scheduling tail. Usage: e2e dist <iters>
    if std::env::args().nth(1).as_deref() == Some("dist") {
        let iters: u64 = std::env::args()
            .nth(2)
            .and_then(|a| a.parse().ok())
            .unwrap_or(20_000);
        println!("=== DIST: full latency distribution, in-window vs paid, loopback ===");
        println!("connector: {CONNECTOR_BIN}");
        println!("n per case: {iters}");
        println!("payload sizes are mesh-llm's own decode activation frame:");
        println!("  76 + n_embd*2 bytes, F16 -- n_embd 4096 -> 8268 B, n_embd 8192 -> 16460 B\n");
        for payload in [8268usize, 16460] {
            println!("--- payload {payload} B ---");
            let free = run_case(
                &format!("IN-WINDOW proxy: price=0, claimless {payload}B"),
                0,
                None,
                payload,
                iters,
                key_file.path(),
                &identity,
                &secret,
            )
            .await;
            dist_line(&format!("  IN-WINDOW (free path) {payload}B"), free);

            let sd = tempfile::tempdir().unwrap();
            let paid = run_case(
                &format!("PAID per packet: price=100, disk journal {payload}B"),
                100,
                Some(sd.path()),
                payload,
                iters.min(3_000),
                key_file.path(),
                &identity,
                &secret,
            )
            .await;
            dist_line(&format!("  PAID per packet {payload}B"), paid);

            // Control: the same websocket round trip with NOTHING in the
            // middle -- isolates OS + tokio + tungstenite tail from the
            // connector's own.
            let ctl = ws_echo(payload, iters).await;
            dist_line(&format!("  CONTROL raw WS echo {payload}B"), ctl);
            println!();
        }
        return;
    }

    println!("=== e2e: paid BTP round trip through a REAL connector process (loopback) ===");
    println!("connector: {CONNECTOR_BIN}");
    println!("iters per case: {iters}\n");

    for payload in payloads {
        println!("--- payload {payload} B ---");
        let _ = run_case(
            &format!("A  FREE  price=0  no journal      {payload}B"),
            0,
            None,
            payload,
            iters,
            key_file.path(),
            &identity,
            &secret,
        )
        .await;

        let sd = tempfile::tempdir().unwrap();
        let _ = run_case(
            &format!("B  FREE  price=0  state_dir=disk  {payload}B"),
            0,
            Some(sd.path()),
            payload,
            iters,
            key_file.path(),
            &identity,
            &secret,
        )
        .await;

        let sd2 = tempfile::tempdir().unwrap();
        let _ = run_case(
            &format!("C  PAID  price=100 state_dir=disk {payload}B"),
            100,
            Some(sd2.path()),
            payload,
            iters,
            key_file.path(),
            &identity,
            &secret,
        )
        .await;

        // fsync counterfactual: the same paid path with the journal on a
        // RAM-backed filesystem, if one is mounted.
        let ram = std::path::Path::new("/dev/shm");
        if ram.is_dir() {
            let sd3 = tempfile::tempdir_in(ram).unwrap();
            let _ = run_case(
                &format!("D  PAID  price=100 state_dir=/dev/shm {payload}B"),
                100,
                Some(sd3.path()),
                payload,
                iters,
                key_file.path(),
                &identity,
                &secret,
            )
            .await;
        }
        println!();
    }
}
