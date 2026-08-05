//! Attribution control: the connector's terminating hop makes its OWN
//! loopback HTTP round trip to the app behind it. This measures just that
//! leg -- raw HTTP/1.1 POST over a keep-alive TCP connection to the same
//! `stub-app` binary -- so the in-window path's tail can be split into
//! "second loopback round trip" vs "connector's own work".

use std::io::{BufRead, BufReader, Read, Write};
use std::net::TcpStream;
use std::process::{Command, Stdio};
use std::time::Instant;

fn dist(label: &str, mut s: Vec<f64>) {
    s.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let n = s.len();
    let p = |q: f64| s[(((n as f64) * q / 100.0) as usize).min(n - 1)] / 1000.0;
    let mean = s.iter().sum::<f64>() / n as f64 / 1000.0;
    println!(
        "{label:<44} n={n:<7} p50={:>8.4} p90={:>8.4} p99={:>8.4} p99.9={:>8.4} max={:>9.4} mean={:>8.4}  (ms)",
        p(50.0), p(90.0), p(99.0), p(99.9), s[n - 1] / 1000.0, mean
    );
}

fn main() {
    let iters: usize = std::env::args()
        .nth(1)
        .and_then(|a| a.parse().ok())
        .unwrap_or(20_000);
    let mut child = Command::new("/home/jonathan/Documents/connector/target/release/stub-app")
        .arg("127.0.0.1:0")
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .expect("stub-app");
    let mut out = BufReader::new(child.stdout.take().unwrap());
    let mut line = String::new();
    out.read_line(&mut line).unwrap();
    let addr = line.trim().strip_prefix("stub-app listening ").unwrap().to_string();
    println!("=== connector -> app hop: raw HTTP/1.1 POST on loopback, keep-alive ===");
    println!("stub-app: {addr}");

    for size in [8268usize, 16460] {
        let mut sock = TcpStream::connect(&addr).unwrap();
        sock.set_nodelay(true).unwrap();
        let body = vec![0xb7u8; size];
        let head = format!(
            "POST / HTTP/1.1\r\nHost: {addr}\r\nContent-Length: {size}\r\nContent-Type: application/octet-stream\r\n\r\n"
        );
        // Response is "delivered by stub app: " + body, so read exactly that.
        let expect_body = 23 + size;
        let mut samples = Vec::with_capacity(iters);
        let mut reader = BufReader::new(sock.try_clone().unwrap());
        for i in 0..(iters + 200) {
            let t = Instant::now();
            sock.write_all(head.as_bytes()).unwrap();
            sock.write_all(&body).unwrap();
            sock.flush().unwrap();
            // headers
            let mut hdr = String::new();
            loop {
                hdr.clear();
                reader.read_line(&mut hdr).unwrap();
                if hdr == "\r\n" {
                    break;
                }
            }
            let mut buf = vec![0u8; expect_body];
            reader.read_exact(&mut buf).unwrap();
            if i >= 200 {
                samples.push(t.elapsed().as_secs_f64() * 1_000_000.0);
            }
        }
        dist(&format!("  APP HOP raw HTTP POST {size}B"), samples);
    }
    let _ = child.kill();
}
