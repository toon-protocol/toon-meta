// Deterministic synthetic video load. NO codec — what matters for the
// transport question is the SIZE/TIMING shape of encoded video, which is:
// a constant frame cadence (30fps) whose per-frame byte sizes are bimodal —
// small delta frames punctuated by a keyframe 8-12x larger every GOP —
// with mild per-frame jitter. Everything is seeded so a run is reproducible
// byte-for-byte.

// mulberry32: tiny deterministic PRNG.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Codec-realistic targets (H.264/VP9-ish ballpark at streaming quality):
//   720p30  @ 2.5 Mbps — mid of the 1.5-3 Mbps design band
//   1080p30 @ 5.0 Mbps — mid of the 3-6 Mbps design band
// GOP 2s (60 frames), keyframe = 10x an average delta frame. Solving
// K + 59p = bytes-per-gop with K = 10p gives p = gop/69:
//   720p:  p ≈ 9.06 KB, K ≈ 90.6 KB   (avg frame ≈ 10.4 KB)
//   1080p: p ≈ 18.1 KB, K ≈ 181 KB    (avg frame ≈ 20.8 KB)
// Both sit inside the "encoded frames average ~6-25 KB, keyframes 5-10x
// larger every 1-2s" brief.
export const PROFILES = {
  '720p': { name: '720p', mbps: 2.5, fps: 30, gopSec: 2, kfRatio: 10 },
  '1080p': { name: '1080p', mbps: 5.0, fps: 30, gopSec: 2, kfRatio: 10 },
  // sub-720p fallback used to find where the pipeline DOES hold
  '360p': { name: '360p', mbps: 0.8, fps: 30, gopSec: 2, kfRatio: 10 },
};

// One frame per fps tick: { idx, captureMs, bytes, key }.
export function frameSchedule(profile, seconds, seed = 1) {
  const rnd = mulberry32(seed);
  const { fps, mbps, gopSec, kfRatio } = profile;
  const gopFrames = fps * gopSec;
  const gopBytes = (mbps * 1e6 * gopSec) / 8;
  const p = gopBytes / (kfRatio + (gopFrames - 1)); // delta-frame mean
  const k = kfRatio * p; // keyframe mean
  const frames = [];
  const total = Math.round(fps * seconds);
  for (let i = 0; i < total; i++) {
    const key = i % gopFrames === 0;
    const mean = key ? k : p;
    // +/-15% uniform jitter — encoded frame sizes wobble with content
    const bytes = Math.max(64, Math.round(mean * (0.85 + 0.3 * rnd())));
    frames.push({ idx: i, captureMs: (i * 1000) / fps, bytes, key });
  }
  return frames;
}

// ── Chunking strategies: frames -> events ──────────────────────────────────
// Every event: { seq, sendAtMs, payloadBytes, key, frames:[{idx, captureMs, bytes}] }
// A frame is "delivered" when ALL events carrying any part of it arrived;
// its e2e latency runs from captureMs (what a viewer experiences).

// S1 "frame": one event per encoded frame. 30 ev/s, sizes 6-200 KB.
export function chunkPerFrame(frames) {
  return frames.map((f, seq) => ({
    seq,
    sendAtMs: f.captureMs,
    payloadBytes: f.bytes,
    key: f.key,
    frames: [{ idx: f.idx, captureMs: f.captureMs, bytes: f.bytes }],
  }));
}

// S2 "chunkN": split each frame into <=chunkBytes events (all sent at capture
// time). More events/sec, bounded event size — the shape a fixed-MTU
// transport would force.
export function chunkFixed(frames, chunkBytes) {
  const events = [];
  let seq = 0;
  for (const f of frames) {
    const n = Math.ceil(f.bytes / chunkBytes);
    for (let c = 0; c < n; c++) {
      const bytes = c === n - 1 ? f.bytes - chunkBytes * (n - 1) : chunkBytes;
      events.push({
        seq: seq++,
        sendAtMs: f.captureMs,
        payloadBytes: bytes,
        key: f.key,
        frames: [{ idx: f.idx, captureMs: f.captureMs, bytes, part: c, of: n }],
      });
    }
  }
  return events;
}

// S3 "batchM": accumulate batchMs of frames into one event, sent when the
// bucket closes. Fewer events/sec, bigger events, +batchMs latency floor.
export function chunkBatch(frames, batchMs) {
  const buckets = new Map();
  for (const f of frames) {
    const b = Math.floor(f.captureMs / batchMs);
    if (!buckets.has(b)) buckets.set(b, []);
    buckets.get(b).push(f);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([b, fs], seq) => ({
      seq,
      sendAtMs: (b + 1) * batchMs, // bucket close
      payloadBytes: fs.reduce((a, f) => a + f.bytes, 0),
      key: fs.some((f) => f.key),
      frames: fs.map((f) => ({ idx: f.idx, captureMs: f.captureMs, bytes: f.bytes })),
    }));
}

export function buildEvents(strategy, frames, opts = {}) {
  if (strategy === 'frame') return chunkPerFrame(frames);
  if (strategy === 'chunk') return chunkFixed(frames, opts.chunkBytes ?? 16384);
  if (strategy === 'batch') return chunkBatch(frames, opts.batchMs ?? 100);
  throw new Error(`unknown strategy ${strategy}`);
}
