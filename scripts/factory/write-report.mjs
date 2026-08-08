// Per-write failure isolation (toon-meta#320). The first live unblock-
// dispatcher run aborted the ENTIRE fleet pass because one `gh issue edit`
// failed — buzz had no `needs:human` label yet, `gh` exited 1, and the
// uncaught exception killed the process before any other repo's actions ran.
// Every remaining dispatch/flag/completion action, for every OTHER repo, was
// silently skipped and the run read as a red X with no per-repo report.
//
// `runWrite` is the fix: it never lets a write's exception escape. The error
// is caught and recorded against `target` in a report that accumulates
// across the whole pass, and the caller's loop continues to the next action
// unconditionally — one bad write degrades to "this one thing didn't happen"
// instead of "nothing after this happened". `hasFailures` is what the shell
// checks at the very end to decide the exit code: failures must still be
// visible (exit non-zero), just not fatal to the rest of the pass.

export function createWriteReport() {
  return { succeeded: [], failed: [] };
}

// Runs `fn` (one `gh` write, or a short fixed sequence of them that only
// make sense together, e.g. label-then-comment) under try/catch. Returns
// true/false so a caller can vary its own log line, but the report — not the
// return value — is the source of truth the final summary reads from.
export function runWrite(report, { type, target, detail } = {}, fn) {
  try {
    fn();
    report.succeeded.push({ type, target, detail });
    return true;
  } catch (err) {
    report.failed.push({ type, target, detail, error: err.message ?? String(err) });
    return false;
  }
}

export const hasFailures = (report) => report.failed.length > 0;

export function formatFailedSection(report) {
  if (!report.failed.length) return "";
  const lines = [`Failed writes (${report.failed.length}):`];
  for (const f of report.failed) {
    lines.push(`   [FAILED] ${f.type} · ${f.target}${f.detail ? ` (${f.detail})` : ""}: ${f.error}`);
  }
  return lines.join("\n");
}

// Preflight (bonus, toon-meta#320): a missing trigger label is config drift,
// not a per-issue error — it will fail every write that touches it, one
// issue at a time, until someone notices the pattern. Reported explicitly, up
// front, instead of discovered as N identically-shaped failed writes deep in
// a run. Pure: `labelsByRepo` is fetched by the caller so this stays
// unit-testable without a network.
export function planLabelPreflight({ repos, requiredLabels, labelsByRepo }) {
  const missing = {};
  for (const repo of repos) {
    const have = new Set(labelsByRepo[repo] ?? []);
    const gap = requiredLabels.filter((l) => !have.has(l));
    if (gap.length) missing[repo] = gap;
  }
  return missing;
}
