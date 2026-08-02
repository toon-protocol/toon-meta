//! Counterfactual benchmark: the connector's PLANNED in-place claim-gate fix
//! (connector#686) -- watermark check under a brief lock, journal appends
//! group-committed (batched writes + one fsync per batch) OUTSIDE the lock --
//! versus the CURRENT shape (per-claim append+fsync under the global write
//! lock), on the same claim-gate workload the TigerBeetle benchmark replays.
//!
//! Deliberately std-only, same journal line format as
//! connector-runtime/src/journal.rs (`inbound_claim_accepted` with a 65-byte
//! signature hex-encoded), same durable-before-visible ordering:
//!   fixed mode: under the write lock the watermark advances and the entry is
//!   enqueued (so journal order == watermark order), the lock is released,
//!   and the claim is only ACKed once the writer thread reports its batch
//!   fsync'd. No service is rendered against an unfsync'd watermark.
//!
//! Modes:
//!   counterfactual current    <sessions> <seconds>
//!   counterfactual fixed      <sessions> <seconds>
//!   counterfactual latency-current <sessions> <rate> <seconds>
//!   counterfactual latency-fixed   <sessions> <rate> <seconds>
//!   counterfactual fsync-probe

use std::collections::HashMap;
use std::fs::{File, OpenOptions};
use std::io::Write;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Condvar, Mutex, RwLock};
use std::time::{Duration, Instant};

/// 65-byte secp256k1 signature, hex-encoded (130 chars) -- matches the
/// real journal entry's dominant field size.
fn sig_hex() -> String {
    "ab".repeat(65)
}

#[derive(Clone, Copy, Default)]
struct Watermark {
    nonce: u64,
    cumulative: u64,
}

fn encode_line(channel: &str, nonce: u64, cumulative: u64, sig: &str) -> String {
    // Mirrors journal.rs encode_line for InboundClaimAccepted.
    format!("inbound_claim_accepted\t{channel}\t{nonce}\t{cumulative}\t{sig}\n")
}

/// One claim acceptance completion slot (ack after fsync).
struct AckSlot {
    done: Mutex<bool>,
    cv: Condvar,
}

impl AckSlot {
    fn new() -> Arc<Self> {
        Arc::new(AckSlot { done: Mutex::new(false), cv: Condvar::new() })
    }
    fn signal(&self) {
        *self.done.lock().unwrap() = true;
        self.cv.notify_one();
    }
    fn wait(&self) {
        let mut g = self.done.lock().unwrap();
        while !*g {
            g = self.cv.wait(g).unwrap();
        }
    }
}

/// CURRENT shape: global RwLock, per-claim write+fsync held under the
/// write lock (claim_gate.rs:429-467 + journal.rs:183-188).
struct CurrentGate {
    watermarks: RwLock<HashMap<u32, Watermark>>,
    file: Mutex<File>,
}

impl CurrentGate {
    fn ingest(&self, session: u32, nonce: u64, cumulative: u64, price: u64, sig: &str) -> bool {
        let channel = format!("channel-{session:04}");
        {
            let wm = self.watermarks.read().unwrap();
            if !check(wm.get(&session).copied(), nonce, cumulative, price) {
                return false;
            }
        }
        let mut wm = self.watermarks.write().unwrap();
        if !check(wm.get(&session).copied(), nonce, cumulative, price) {
            return false;
        }
        {
            let mut f = self.file.lock().unwrap();
            f.write_all(encode_line(&channel, nonce, cumulative, sig).as_bytes()).unwrap();
            f.sync_data().unwrap(); // per-claim fsync UNDER the watermark write lock
        }
        wm.insert(session, Watermark { nonce, cumulative });
        true
    }
}

/// FIXED shape (planned in-place fix): brief write lock (check + advance +
/// enqueue), group-commit writer thread does batched write + one fsync,
/// then acks every claim in the batch.
struct FixedGate {
    watermarks: RwLock<HashMap<u32, Watermark>>,
    tx: Sender<(String, Arc<AckSlot>)>,
}

impl FixedGate {
    fn ingest(&self, session: u32, nonce: u64, cumulative: u64, price: u64, sig: &str) -> bool {
        let channel = format!("channel-{session:04}");
        {
            let wm = self.watermarks.read().unwrap();
            if !check(wm.get(&session).copied(), nonce, cumulative, price) {
                return false;
            }
        }
        let slot = AckSlot::new();
        {
            let mut wm = self.watermarks.write().unwrap();
            if !check(wm.get(&session).copied(), nonce, cumulative, price) {
                return false;
            }
            // Advance + enqueue under the lock: journal order == watermark
            // order. The fsync happens outside; visibility (the ACK that
            // renders service) waits for it.
            wm.insert(session, Watermark { nonce, cumulative });
            self.tx
                .send((encode_line(&channel, nonce, cumulative, sig), slot.clone()))
                .unwrap();
        }
        slot.wait(); // durable-before-ACK
        true
    }
}

fn check(current: Option<Watermark>, nonce: u64, cumulative: u64, price: u64) -> bool {
    let cur = current.unwrap_or_default();
    nonce > cur.nonce && cumulative > cur.cumulative && cumulative - cur.cumulative >= price
}

/// Group-commit writer: drain everything queued (bounded), one write, one
/// fsync, ack all.
fn writer_thread(rx: Receiver<(String, Arc<AckSlot>)>, mut file: File, batch_max: usize, stats: Arc<WriterStats>) {
    let mut buf = String::with_capacity(batch_max * 200);
    let mut slots: Vec<Arc<AckSlot>> = Vec::with_capacity(batch_max);
    while let Ok(first) = rx.recv() {
        buf.clear();
        slots.clear();
        buf.push_str(&first.0);
        slots.push(first.1);
        while slots.len() < batch_max {
            match rx.try_recv() {
                Ok((line, slot)) => {
                    buf.push_str(&line);
                    slots.push(slot);
                }
                Err(_) => break,
            }
        }
        file.write_all(buf.as_bytes()).unwrap();
        file.sync_data().unwrap();
        stats.batches.fetch_add(1, Ordering::Relaxed);
        stats.entries.fetch_add(slots.len() as u64, Ordering::Relaxed);
        for s in &slots {
            s.signal();
        }
    }
}

#[derive(Default)]
struct WriterStats {
    batches: AtomicU64,
    entries: AtomicU64,
}

/// Directory the journal files land in -- same disk as the TigerBeetle data
/// file so both benchmarks pay the same fsync. Override with CF_JOURNAL_DIR.
fn jdir() -> String {
    std::env::var("CF_JOURNAL_DIR").unwrap_or_else(|_| "/tmp".to_string())
}

fn open_journal(path: &str) -> File {
    let _ = std::fs::remove_file(path);
    OpenOptions::new().create(true).append(true).open(path).unwrap()
}

fn percentile(sorted: &[f64], p: f64) -> f64 {
    sorted[((sorted.len() as f64 * p / 100.0) as usize).min(sorted.len() - 1)]
}

fn run_throughput(mode: &str, sessions: u32, seconds: u64) {
    let sig = sig_hex();
    let stop = Arc::new(AtomicBool::new(false));
    let accepted = Arc::new(AtomicU64::new(0));
    let stats = Arc::new(WriterStats::default());

    let fixed: Option<Arc<FixedGate>>;
    let current: Option<Arc<CurrentGate>>;
    match mode {
        "fixed" => {
            let (tx, rx) = mpsc::channel();
            let file = open_journal(&format!("{}/cf-journal-fixed.log", jdir()));
            let st = stats.clone();
            std::thread::spawn(move || writer_thread(rx, file, 8192, st));
            fixed = Some(Arc::new(FixedGate { watermarks: RwLock::new(HashMap::new()), tx }));
            current = None;
        }
        _ => {
            current = Some(Arc::new(CurrentGate {
                watermarks: RwLock::new(HashMap::new()),
                file: Mutex::new(open_journal(&format!("{}/cf-journal-current.log", jdir()))),
            }));
            fixed = None;
        }
    }

    let t0 = Instant::now();
    let mut handles = Vec::new();
    for s in 0..sessions {
        let stop = stop.clone();
        let accepted = accepted.clone();
        let fixed = fixed.clone();
        let current = current.clone();
        let sig = sig.clone();
        handles.push(std::thread::spawn(move || {
            let mut nonce = 0u64;
            let mut cum = 0u64;
            while !stop.load(Ordering::Relaxed) {
                nonce += 1;
                cum += 20;
                let ok = match (&fixed, &current) {
                    (Some(g), _) => g.ingest(s, nonce, cum, 20, &sig),
                    (_, Some(g)) => g.ingest(s, nonce, cum, 20, &sig),
                    _ => unreachable!(),
                };
                if ok {
                    accepted.fetch_add(1, Ordering::Relaxed);
                }
            }
        }));
    }
    std::thread::sleep(Duration::from_secs(seconds));
    stop.store(true, Ordering::Relaxed);
    for h in handles {
        h.join().unwrap();
    }
    let dt = t0.elapsed().as_secs_f64();
    let n = accepted.load(Ordering::Relaxed);
    let batches = stats.batches.load(Ordering::Relaxed);
    println!(
        "{{\"mode\":\"{mode}-throughput\",\"sessions\":{sessions},\"seconds\":{dt:.2},\"claims\":{n},\"cps\":{:.0},\"fsync_batches\":{batches},\"avg_batch_fill\":{:.1}}}",
        n as f64 / dt,
        if batches > 0 { n as f64 / batches as f64 } else { 0.0 }
    );
}

fn run_latency(mode: &str, sessions: u32, rate: u64, seconds: u64) {
    let sig = sig_hex();
    let stats = Arc::new(WriterStats::default());
    let fixed: Option<Arc<FixedGate>>;
    let current: Option<Arc<CurrentGate>>;
    match mode {
        "latency-fixed" => {
            let (tx, rx) = mpsc::channel();
            let file = open_journal(&format!("{}/cf-journal-fixed-lat.log", jdir()));
            let st = stats.clone();
            std::thread::spawn(move || writer_thread(rx, file, 8192, st));
            fixed = Some(Arc::new(FixedGate { watermarks: RwLock::new(HashMap::new()), tx }));
            current = None;
        }
        _ => {
            current = Some(Arc::new(CurrentGate {
                watermarks: RwLock::new(HashMap::new()),
                file: Mutex::new(open_journal(&format!("{}/cf-journal-current-lat.log", jdir()))),
            }));
            fixed = None;
        }
    }

    let interval = Duration::from_nanos(1_000_000_000 / rate);
    let n_per = (rate * seconds) as usize;
    let mut handles = Vec::new();
    for s in 0..sessions {
        let fixed = fixed.clone();
        let current = current.clone();
        let sig = sig.clone();
        handles.push(std::thread::spawn(move || {
            let mut lats = Vec::with_capacity(n_per);
            let start = Instant::now();
            let mut nonce = 0u64;
            let mut cum = 0u64;
            for i in 0..n_per {
                let target = interval * i as u32;
                let elapsed = start.elapsed();
                if target > elapsed {
                    std::thread::sleep(target - elapsed);
                }
                nonce += 1;
                cum += 20;
                let t0 = Instant::now();
                let ok = match (&fixed, &current) {
                    (Some(g), _) => g.ingest(s, nonce, cum, 20, &sig),
                    (_, Some(g)) => g.ingest(s, nonce, cum, 20, &sig),
                    _ => unreachable!(),
                };
                assert!(ok);
                lats.push(t0.elapsed().as_secs_f64() * 1000.0);
            }
            lats
        }));
    }
    let mut all: Vec<f64> = Vec::new();
    for h in handles {
        all.extend(h.join().unwrap());
    }
    all.sort_by(|a, b| a.partial_cmp(b).unwrap());
    println!(
        "{{\"mode\":\"{mode}\",\"sessions\":{sessions},\"rate\":{rate},\"claims\":{},\"p50_ms\":{:.3},\"p95_ms\":{:.3},\"p99_ms\":{:.3},\"max_ms\":{:.3}}}",
        all.len(),
        percentile(&all, 50.0),
        percentile(&all, 95.0),
        percentile(&all, 99.0),
        all[all.len() - 1]
    );
}

fn fsync_probe() {
    let mut f = open_journal(&format!("{}/cf-fsync-probe.log", jdir()));
    let line = encode_line("channel-0000", 1, 20, &sig_hex());
    // warmup
    for _ in 0..10 {
        f.write_all(line.as_bytes()).unwrap();
        f.sync_data().unwrap();
    }
    let mut lats = Vec::with_capacity(200);
    for _ in 0..200 {
        let t0 = Instant::now();
        f.write_all(line.as_bytes()).unwrap();
        f.sync_data().unwrap();
        lats.push(t0.elapsed().as_secs_f64() * 1000.0);
    }
    lats.sort_by(|a, b| a.partial_cmp(b).unwrap());
    println!(
        "{{\"mode\":\"fsync-probe\",\"n\":200,\"p50_ms\":{:.3},\"p99_ms\":{:.3}}}",
        percentile(&lats, 50.0),
        percentile(&lats, 99.0)
    );
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    match args.get(1).map(|s| s.as_str()) {
        Some("current") | Some("fixed") => {
            let mode = args[1].clone();
            let sessions: u32 = args[2].parse().unwrap();
            let seconds: u64 = args.get(3).map(|s| s.parse().unwrap()).unwrap_or(10);
            run_throughput(&mode, sessions, seconds);
        }
        Some("latency-current") | Some("latency-fixed") => {
            let mode = args[1].clone();
            let sessions: u32 = args[2].parse().unwrap();
            let rate: u64 = args[3].parse().unwrap();
            let seconds: u64 = args.get(4).map(|s| s.parse().unwrap()).unwrap_or(10);
            run_latency(&mode, sessions, rate, seconds);
        }
        Some("fsync-probe") => fsync_probe(),
        _ => {
            eprintln!("usage: current|fixed <sessions> <sec> | latency-current|latency-fixed <sessions> <rate> <sec> | fsync-probe");
            std::process::exit(1);
        }
    }
}
