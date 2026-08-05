//! TIER 3: direct iroh QUIC round-trip floor on loopback, at mesh-shard
//! activation sizes. This is the transport the BTP/ILP path is judged
//! against -- what an inter-shard hop costs with no payment layer at all.
//!
//! Two endpoints in one process, connected DIRECTLY (relay mode disabled,
//! explicit direct socket address), one bidirectional stream reused for
//! every round trip -- the shape a pipeline shard boundary would actually
//! use.

use std::time::Instant;

use iroh::endpoint::{presets, Endpoint};
use iroh::{EndpointAddr, SecretKey, TransportAddr};

const ALPN: &[u8] = b"mesh-shard/0";

fn stats(mut s: Vec<f64>) -> (f64, f64, f64, f64) {
    s.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let n = s.len();
    let p = |q: f64| s[(((n as f64) * q / 100.0) as usize).min(n - 1)];
    (p(50.0), p(90.0), p(99.0), *s.last().unwrap())
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    println!("=== iroh direct QUIC RTT, loopback (see Cargo.lock for resolved version) ===");

    let server_key = SecretKey::generate();
    let server = Endpoint::builder(presets::Minimal)
        .secret_key(server_key)
        .alpns(vec![ALPN.to_vec()])
        .relay_mode(iroh::RelayMode::Disabled)
        .bind()
        .await?;
    let server_id = server.id();
    let server_addrs: Vec<std::net::SocketAddr> = server
        .bound_sockets()
        .into_iter()
        .filter(|a| a.ip().is_loopback() || a.ip().is_unspecified())
        .map(|a| {
            if a.ip().is_unspecified() {
                std::net::SocketAddr::new(std::net::Ipv4Addr::LOCALHOST.into(), a.port())
            } else {
                a
            }
        })
        .collect();
    println!("server node {server_id} direct addrs {server_addrs:?}");

    tokio::spawn(async move {
        while let Some(incoming) = server.accept().await {
            tokio::spawn(async move {
                let conn = match incoming.await {
                    Ok(c) => c,
                    Err(_) => return,
                };
                while let Ok((mut send, mut recv)) = conn.accept_bi().await {
                    tokio::spawn(async move {
                        let mut hdr = [0u8; 4];
                        while recv.read_exact(&mut hdr).await.is_ok() {
                            let len = u32::from_be_bytes(hdr) as usize;
                            let mut buf = vec![0u8; len];
                            if recv.read_exact(&mut buf).await.is_err() {
                                break;
                            }
                            if send.write_all(&hdr).await.is_err() {
                                break;
                            }
                            if send.write_all(&buf).await.is_err() {
                                break;
                            }
                        }
                    });
                }
            });
        }
    });

    let client = Endpoint::builder(presets::Minimal)
        .secret_key(SecretKey::generate())
        .relay_mode(iroh::RelayMode::Disabled)
        .bind()
        .await?;

    let addr = EndpointAddr {
        id: server_id,
        addrs: server_addrs.into_iter().map(TransportAddr::Ip).collect(),
    };
    let t0 = Instant::now();
    let conn = client.connect(addr, ALPN).await?;
    println!("connect (cold handshake): {:.3}ms", t0.elapsed().as_secs_f64() * 1000.0);

    let (mut send, mut recv) = conn.open_bi().await?;
    // Kick the stream open (iroh opens lazily on first write).
    send.write_all(&0u32.to_be_bytes()).await?;
    let mut hdr = [0u8; 4];
    recv.read_exact(&mut hdr).await?;

    for size in [8268usize, 16460, 64, 1024, 16 * 1024, 32 * 1024, 64 * 1024, 256 * 1024] {
        let payload = vec![0x5au8; size];
        let hdr_out = (size as u32).to_be_bytes();
        let mut back = vec![0u8; size];
        let iters: usize = std::env::args().nth(1).and_then(|a| a.parse().ok()).unwrap_or(if size >= 256 * 1024 { 500 } else { 2000 });
        for _ in 0..200 {
            send.write_all(&hdr_out).await?;
            send.write_all(&payload).await?;
            recv.read_exact(&mut hdr).await?;
            recv.read_exact(&mut back).await?;
        }
        let mut samples = Vec::with_capacity(iters);
        for _ in 0..iters {
            let t = Instant::now();
            send.write_all(&hdr_out).await?;
            send.write_all(&payload).await?;
            recv.read_exact(&mut hdr).await?;
            recv.read_exact(&mut back).await?;
            samples.push(t.elapsed().as_secs_f64() * 1_000_000.0);
        }
        let mut sorted = samples.clone();
        sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());
        let n = sorted.len();
        let q = |x: f64| sorted[(((n as f64) * x / 100.0) as usize).min(n - 1)] / 1000.0;
        let mean = sorted.iter().sum::<f64>() / n as f64 / 1000.0;
        println!(
            "iroh QUIC RTT {size:>7}B  n={n:<7} p50={:>8.4} p90={:>8.4} p99={:>8.4} p99.9={:>8.4} max={:>9.4} mean={:>8.4}  (ms)",
            q(50.0), q(90.0), q(99.0), q(99.9), sorted[n-1]/1000.0, mean
        );
    }
    Ok(())
}
