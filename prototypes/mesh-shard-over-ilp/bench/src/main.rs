//! mesh-shard-over-ilp: per-packet cost decomposition for one paid ILP
//! packet on loopback.
//!
//! Answers "where does the ~20 ms/packet go?" by timing each stage of the
//! paid-packet path in isolation, against the SAME code the connector runs
//! (crates are path deps into /home/jonathan/Documents/connector, read-only).
//!
//! Run:
//!   cargo run --release -- all
//! Sections:
//!   crypto   -- EIP-712 digest, secp256k1 sign, secp256k1 verify/recover
//!   giftwrap -- ADR 0018/0019 seal_request/open_request/seal_response/open_response
//!   oer      -- ILP OER Prepare/Fulfill encode+decode at payload sizes
//!   journal  -- FileJournal::append (fsync per entry) vs append_batch
//!   gate     -- ClientClaimGate::ingest end to end, serial and concurrent
//!   sizes    -- claim-gate + giftwrap + oer at 1K/16K/32K/64K payloads

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use chrono::{TimeZone, Utc};
use connector_client_edge::{ClientChannelRegistry, ClientClaimGate, DepositFloor, EvmChannel};
use connector_domain::{Fulfill, JournalEntry, Prepare};
use connector_runtime::{FileJournal, Journal};
use connector_signer::giftwrap::{open_request, open_response, seal_request, seal_response};
use connector_signer::{
    derive_evm_address, evm_balance_proof_digest, to_hex, EvmBalanceProof, LocalSigner, Signer,
};
use libsecp256k1::{Message, PublicKey, SecretKey};

const EVM_CHAIN_ID: u64 = 8453;
const TOKEN_NETWORK: [u8; 20] = [0x42; 20];
const PRICE: u64 = 20;

// ---------------------------------------------------------------- helpers

fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn signer_key() -> (SecretKey, [u8; 20]) {
    let secret = SecretKey::parse(&[9u8; 32]).unwrap();
    let public = PublicKey::from_secret_key(&secret);
    (secret, derive_evm_address(&public.serialize()))
}

fn channel_id_bytes(index: u32) -> [u8; 32] {
    let mut id = [0xabu8; 32];
    id[..4].copy_from_slice(&index.to_be_bytes());
    id
}

fn channel_id_hex(index: u32) -> String {
    format!("0x{}", hex_encode(&channel_id_bytes(index)))
}

fn registry(sessions: u32) -> ClientChannelRegistry {
    let (_, address) = signer_key();
    let mut channels = ClientChannelRegistry::new();
    for index in 0..sessions {
        channels
            .record_evm(
                &channel_id_hex(index),
                EvmChannel {
                    counterparty: address,
                    chain_id: EVM_CHAIN_ID,
                    token_network_address: TOKEN_NETWORK,
                    deposit_floor: DepositFloor::Unknown,
                },
            )
            .expect("32-byte hex channel id");
    }
    channels
}

fn signed_claim_json(secret: &SecretKey, session: u32, nonce: u64, amount: u64) -> String {
    let proof = EvmBalanceProof {
        channel_id: channel_id_bytes(session),
        nonce,
        transferred_amount: u128::from(amount),
        locked_amount: 0,
        locks_root: [0u8; 32],
        chain_id: EVM_CHAIN_ID,
        token_network_address: TOKEN_NETWORK,
    };
    let message = Message::parse(&evm_balance_proof_digest(&proof));
    let (signature, recovery_id) = libsecp256k1::sign(&message, secret);
    let mut signature_bytes = signature.serialize().to_vec();
    let recovery_byte: u8 = recovery_id.into();
    signature_bytes.push(recovery_byte + 27);
    let (_, address) = signer_key();
    format!(
        r#"{{"version":"1.0","blockchain":"evm","messageId":"msg-{nonce}",
"timestamp":"2026-02-02T12:00:00.000Z","senderId":"bench",
"channelId":"{channel_id}","nonce":{nonce},"transferredAmount":"{amount}",
"lockedAmount":"0","locksRoot":"0x{zeros}","signature":"0x{signature}",
"signerAddress":"{signer}","chainId":{EVM_CHAIN_ID},"tokenNetworkAddress":"{token_network}"}}"#,
        channel_id = channel_id_hex(session),
        zeros = "0".repeat(64),
        signature = hex_encode(&signature_bytes),
        signer = to_hex(&address),
        token_network = to_hex(&TOKEN_NETWORK),
    )
}

struct Stats {
    p50: f64,
    p90: f64,
    p99: f64,
    mean: f64,
    max: f64,
    n: usize,
}

fn stats(mut samples: Vec<f64>) -> Stats {
    samples.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let n = samples.len();
    let pick = |p: f64| samples[(((n as f64) * p / 100.0) as usize).min(n - 1)];
    Stats {
        p50: pick(50.0),
        p90: pick(90.0),
        p99: pick(99.0),
        mean: samples.iter().sum::<f64>() / n as f64,
        max: *samples.last().unwrap(),
        n,
    }
}

/// Print a timing line in microseconds (the natural unit for everything
/// except the fsync-bound paths, which are also printed in ms).
fn report(label: &str, s: Stats) {
    println!(
        "{label:<46} n={:<7} p50={:>10.3}us p90={:>10.3}us p99={:>10.3}us mean={:>10.3}us max={:>10.3}us  (p50={:.4}ms)",
        s.n, s.p50, s.p90, s.p99, s.mean, s.max, s.p50 / 1000.0
    );
}

fn time_n<F: FnMut()>(label: &str, iters: usize, mut f: F) {
    // warmup
    for _ in 0..(iters / 10).max(1) {
        f();
    }
    let mut samples = Vec::with_capacity(iters);
    for _ in 0..iters {
        let t = Instant::now();
        f();
        samples.push(t.elapsed().as_secs_f64() * 1_000_000.0);
    }
    report(label, stats(samples));
}

// ---------------------------------------------------------------- crypto

fn bench_crypto() {
    println!("\n--- SECTION: crypto (per-claim signature work) ---");
    let (secret, _) = signer_key();
    let proof = EvmBalanceProof {
        channel_id: channel_id_bytes(0),
        nonce: 1,
        transferred_amount: 20,
        locked_amount: 0,
        locks_root: [0u8; 32],
        chain_id: EVM_CHAIN_ID,
        token_network_address: TOKEN_NETWORK,
    };

    time_n("eip712 digest (evm_balance_proof_digest)", 20_000, || {
        std::hint::black_box(evm_balance_proof_digest(&proof));
    });

    let digest = evm_balance_proof_digest(&proof);
    time_n("secp256k1 sign (claim signing, CLIENT side)", 2_000, || {
        let m = Message::parse(&digest);
        std::hint::black_box(libsecp256k1::sign(&m, &secret));
    });

    let m = Message::parse(&digest);
    let (sig, rec) = libsecp256k1::sign(&m, &secret);
    time_n(
        "secp256k1 recover (claim verify, CONNECTOR side)",
        2_000,
        || {
            std::hint::black_box(libsecp256k1::recover(&m, &sig, &rec).unwrap());
        },
    );

    // Full claim JSON build (what a client does per packet) and full parse+
    // verify (what the connector does per packet), minus any I/O.
    time_n("build signed claim JSON (client per-packet)", 2_000, || {
        std::hint::black_box(signed_claim_json(&secret, 0, 1, 20));
    });
}

// -------------------------------------------------------------- giftwrap

fn bench_giftwrap(sizes: &[usize]) {
    println!("\n--- SECTION: giftwrap (ADR 0018/0019 payload sealing) ---");
    let signer = LocalSigner::generate("bench");
    let receiver_public = signer.public_key().unwrap();

    for &size in sizes {
        let plaintext = vec![0xa5u8; size];
        time_n(
            &format!("seal_request  {size:>6}B (sender: ECDH+HKDF+ChaCha20)"),
            500,
            || {
                std::hint::black_box(seal_request(&plaintext, &receiver_public).unwrap());
            },
        );
        let (sealed, secret) = seal_request(&plaintext, &receiver_public).unwrap();
        time_n(
            &format!("open_request  {size:>6}B (connector: ECDH+HKDF+decrypt)"),
            500,
            || {
                std::hint::black_box(open_request(&sealed, &signer).unwrap());
            },
        );
        time_n(
            &format!("seal_response {size:>6}B (connector: HKDF+encrypt)"),
            500,
            || {
                std::hint::black_box(seal_response(&secret, &plaintext));
            },
        );
        let sealed_resp = seal_response(&secret, &plaintext);
        time_n(
            &format!("open_response {size:>6}B (sender: HKDF+decrypt)"),
            500,
            || {
                std::hint::black_box(open_response(&secret, &sealed_resp).unwrap());
            },
        );
        println!(
            "  size expansion: plaintext {size}B -> sealed_request {}B (+{}B) / sealed_response {}B (+{}B)",
            sealed.len(),
            sealed.len() - size,
            sealed_resp.len(),
            sealed_resp.len() - size
        );
    }
}

// ------------------------------------------------------------------- oer

fn bench_oer(sizes: &[usize]) {
    println!("\n--- SECTION: ILP OER encode/decode ---");
    for &size in sizes {
        let prepare = Prepare {
            amount: 1000,
            expires_at: Utc.timestamp_opt(1_800_000_000, 0).unwrap(),
            execution_condition: [7u8; 32],
            destination: "g.proxy.relay".to_string(),
            data: vec![0xc3u8; size],
        };
        time_n(&format!("Prepare::encode {size:>6}B payload"), 2_000, || {
            std::hint::black_box(prepare.encode());
        });
        let encoded = prepare.encode();
        time_n(&format!("Prepare::decode {size:>6}B payload"), 2_000, || {
            std::hint::black_box(Prepare::decode(&encoded).unwrap());
        });
        let fulfill = Fulfill {
            fulfillment: [1u8; 32],
            data: vec![0xc3u8; size],
        };
        time_n(&format!("Fulfill::encode {size:>6}B payload"), 2_000, || {
            std::hint::black_box(fulfill.encode());
        });
        let fenc = fulfill.encode();
        time_n(&format!("Fulfill::decode {size:>6}B payload"), 2_000, || {
            std::hint::black_box(Fulfill::decode(&fenc).unwrap());
        });
        println!(
            "  wire size: Prepare {size}B payload -> {}B on the wire (+{}B framing)",
            encoded.len(),
            encoded.len() - size
        );
    }
}

// --------------------------------------------------------------- journal

fn bench_journal() {
    println!("\n--- SECTION: journal (the fsync hypothesis) ---");
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("claims.log");
    println!("  journal path: {} (TMPDIR filesystem)", path.display());
    let journal = FileJournal::open(&path).unwrap();

    let entry = |n: u64| JournalEntry::InboundClaimAccepted {
        channel_id: channel_id_hex(0),
        nonce: n,
        cumulative_amount: n * PRICE,
        signature: vec![0x11u8; 65],
    };

    let mut n = 0u64;
    time_n("FileJournal::append (write + sync_data)", 300, || {
        n += 1;
        journal.append(&entry(n)).unwrap();
    });

    for batch in [1usize, 8, 64, 512] {
        let dir2 = tempfile::tempdir().unwrap();
        let j2 = FileJournal::open(dir2.path().join("c.log")).unwrap();
        let mut m = 0u64;
        let mut samples = Vec::new();
        for _ in 0..50 {
            let entries: Vec<JournalEntry> = (0..batch)
                .map(|_| {
                    m += 1;
                    entry(m)
                })
                .collect();
            let t = Instant::now();
            j2.append_batch(&entries).unwrap();
            samples.push(t.elapsed().as_secs_f64() * 1_000_000.0 / batch as f64);
        }
        report(
            &format!("FileJournal::append_batch batch={batch:<4} PER-ENTRY"),
            stats(samples),
        );
    }

    // Isolate the fsync itself from the write: same file, no sync.
    {
        use std::io::Write as _;
        let dir3 = tempfile::tempdir().unwrap();
        let mut f = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(dir3.path().join("raw.log"))
            .unwrap();
        let line = "inbound_claim_accepted\t0xab\t1\t20\t1111\n";
        time_n("raw write() only, NO fsync", 2_000, || {
            f.write_all(line.as_bytes()).unwrap();
        });
        time_n("raw write() + sync_data() (bare fsync cost)", 300, || {
            f.write_all(line.as_bytes()).unwrap();
            f.sync_data().unwrap();
        });
    }
}

// ------------------------------------------------------------------ gate

async fn bench_gate() {
    println!("\n--- SECTION: ClientClaimGate::ingest (full admission path) ---");
    let (secret, _) = signer_key();

    // Serial: one session, one claim at a time. This is the PIPELINE-PARALLEL
    // shape -- a strictly sequential dependency chain -- where group commit
    // (#686) has nothing to batch with.
    {
        let dir = tempfile::tempdir().unwrap();
        let journal = FileJournal::open(dir.path().join("claims.log")).unwrap();
        let gate = Arc::new(ClientClaimGate::restore(registry(1), Arc::new(journal)).unwrap());
        let mut samples = Vec::new();
        for nonce in 1..=400u64 {
            let claim = signed_claim_json(&secret, 0, nonce, nonce * PRICE);
            let t = Instant::now();
            gate.ingest(&claim, PRICE).await.unwrap();
            samples.push(t.elapsed().as_secs_f64() * 1_000_000.0);
        }
        report("gate.ingest SERIAL (1 session, sequential)", stats(samples));
    }

    // Concurrent: N independent sessions in flight, group commit amortizes.
    for sessions in [8u32, 64] {
        let dir = tempfile::tempdir().unwrap();
        let journal = FileJournal::open(dir.path().join("claims.log")).unwrap();
        let gate =
            Arc::new(ClientClaimGate::restore(registry(sessions), Arc::new(journal)).unwrap());
        let counted = Arc::new(AtomicU64::new(0));
        let per = 100u64;
        let start = Instant::now();
        let mut tasks = Vec::new();
        for s in 0..sessions {
            let gate = gate.clone();
            let counted = counted.clone();
            tasks.push(tokio::spawn(async move {
                let (secret, _) = signer_key();
                let mut samples = Vec::new();
                for nonce in 1..=per {
                    let claim = signed_claim_json(&secret, s, nonce, nonce * PRICE);
                    let t = Instant::now();
                    gate.ingest(&claim, PRICE).await.unwrap();
                    samples.push(t.elapsed().as_secs_f64() * 1_000_000.0);
                    counted.fetch_add(1, Ordering::Relaxed);
                }
                samples
            }));
        }
        let mut all = Vec::new();
        for t in tasks {
            all.extend(t.await.unwrap());
        }
        let elapsed = start.elapsed().as_secs_f64();
        report(
            &format!("gate.ingest CONCURRENT sessions={sessions:<3}"),
            stats(all),
        );
        println!(
            "  aggregate: {:.0} claims/sec across {sessions} sessions ({} claims in {elapsed:.2}s)",
            counted.load(Ordering::Relaxed) as f64 / elapsed,
            counted.load(Ordering::Relaxed)
        );
    }

    // The decision half only -- admit() is pub(crate), so approximate the
    // "no-durability" cost by measuring an in-memory journal gate, which has
    // an fsync-free append.
    {
        let gate = Arc::new(
            ClientClaimGate::restore(
                registry(1),
                Arc::new(connector_runtime::InMemoryJournal::default()),
            )
            .unwrap(),
        );
        let mut samples = Vec::new();
        for nonce in 1..=2_000u64 {
            let claim = signed_claim_json(&secret, 0, nonce, nonce * PRICE);
            let t = Instant::now();
            gate.ingest(&claim, PRICE).await.unwrap();
            samples.push(t.elapsed().as_secs_f64() * 1_000_000.0);
        }
        report(
            "gate.ingest SERIAL w/ InMemoryJournal (NO fsync)",
            stats(samples),
        );
    }
}

// ----------------------------------------------------------------- main

#[tokio::main(flavor = "multi_thread", worker_threads = 16)]
async fn main() {
    let arg = std::env::args().nth(1).unwrap_or_else(|| "all".to_string());
    let sizes = [1024usize, 16 * 1024, 32 * 1024, 64 * 1024];

    println!("=== mesh-shard-over-ilp: per-packet cost decomposition ===");
    println!(
        "host: {} cores | section: {arg}",
        std::thread::available_parallelism()
            .map(|n| n.get())
            .unwrap_or(0)
    );

    if arg == "all" || arg == "crypto" {
        bench_crypto();
    }
    if arg == "all" || arg == "journal" {
        bench_journal();
    }
    if arg == "all" || arg == "gate" {
        bench_gate().await;
    }
    if arg == "all" || arg == "oer" {
        bench_oer(&sizes);
    }
    if arg == "all" || arg == "giftwrap" {
        bench_giftwrap(&sizes);
    }
    println!("\n=== done ===");
    std::mem::drop(Duration::from_secs(0));
}
