//! Loopback transport floor: what a round trip costs with NO payment layer.
//! TCP raw (nodelay on/off) and WebSocket, at mesh-shard activation sizes.

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::time::Instant;

use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::tungstenite::Message;

fn stats(mut s: Vec<f64>) -> (f64, f64, f64, f64) {
    s.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let n = s.len();
    let p = |q: f64| s[(((n as f64) * q / 100.0) as usize).min(n - 1)];
    (p(50.0), p(90.0), p(99.0), *s.last().unwrap())
}

fn line(label: &str, s: Vec<f64>) {
    let n = s.len();
    let (p50, p90, p99, max) = stats(s);
    println!("{label:<52} n={n:<6} p50={p50:>9.3}us p90={p90:>9.3}us p99={p99:>9.3}us max={max:>10.3}us  (p50={:.4}ms)", p50/1000.0);
}

/// Blocking TCP echo round trip: write size bytes, read size bytes back.
fn tcp_rtt(size: usize, nodelay: bool, iters: usize) -> Vec<f64> {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    let handle = std::thread::spawn(move || {
        let (mut sock, _) = listener.accept().unwrap();
        sock.set_nodelay(nodelay).unwrap();
        let mut buf = vec![0u8; size];
        loop {
            match sock.read_exact(&mut buf) {
                Ok(()) => {}
                Err(_) => break,
            }
            if sock.write_all(&buf).is_err() {
                break;
            }
        }
    });
    let mut client = TcpStream::connect(addr).unwrap();
    client.set_nodelay(nodelay).unwrap();
    let payload = vec![0x5au8; size];
    let mut back = vec![0u8; size];
    for _ in 0..(iters / 10).max(1) {
        client.write_all(&payload).unwrap();
        client.read_exact(&mut back).unwrap();
    }
    let mut samples = Vec::with_capacity(iters);
    for _ in 0..iters {
        let t = Instant::now();
        client.write_all(&payload).unwrap();
        client.read_exact(&mut back).unwrap();
        samples.push(t.elapsed().as_secs_f64() * 1_000_000.0);
    }
    drop(client);
    let _ = handle.join();
    samples
}

async fn ws_rtt(size: usize, iters: usize) -> Vec<f64> {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        while let Ok((stream, _)) = listener.accept().await {
            tokio::spawn(async move {
                let mut ws = tokio_tungstenite::accept_async(stream).await.unwrap();
                while let Some(Ok(msg)) = ws.next().await {
                    if let Message::Binary(b) = msg {
                        if ws.send(Message::Binary(b)).await.is_err() {
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
    for _ in 0..(iters / 10).max(1) {
        ws.send(Message::Binary(payload.clone())).await.unwrap();
        let _ = ws.next().await.unwrap().unwrap();
    }
    let mut samples = Vec::with_capacity(iters);
    for _ in 0..iters {
        let t = Instant::now();
        ws.send(Message::Binary(payload.clone())).await.unwrap();
        let _ = ws.next().await.unwrap().unwrap();
        samples.push(t.elapsed().as_secs_f64() * 1_000_000.0);
    }
    samples
}

#[tokio::main]
async fn main() {
    println!("=== loopback transport floor (no payment layer) ===");
    for size in [64usize, 1024, 16 * 1024, 32 * 1024, 64 * 1024, 256 * 1024] {
        line(
            &format!("TCP  RTT {size:>7}B  TCP_NODELAY=ON"),
            tcp_rtt(size, true, 2000),
        );
    }
    for size in [64usize, 1024, 16 * 1024, 32 * 1024, 64 * 1024] {
        line(
            &format!("TCP  RTT {size:>7}B  TCP_NODELAY=OFF (Nagle on)"),
            tcp_rtt(size, false, 2000),
        );
    }
    for size in [64usize, 1024, 16 * 1024, 32 * 1024, 64 * 1024, 256 * 1024] {
        line(
            &format!("WS   RTT {size:>7}B  (tungstenite, default nodelay)"),
            ws_rtt(size, 1000).await,
        );
    }
}
