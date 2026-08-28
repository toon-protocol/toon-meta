#!/usr/bin/env bash
# run-eval.sh — Run structural validation + TOON compliance assertions on a skill
# Usage: ./run-eval.sh <path-to-skill-directory>
# Exit 0 = all checks pass, 1 = at least one check failed
# Dependencies: bash, grep, awk, wc, node (for JSON validation)

set -euo pipefail

SKILL_DIR="${1:?Usage: run-eval.sh <skill-directory>}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# SCRIPT_DIR is <repo>/skills/skill-eval-framework/scripts, so the repo root is
# three levels up, not four, and the skills live at skills/ with no .claude prefix.
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
VALIDATE_SCRIPT="$PROJECT_ROOT/skills/nip-to-toon-skill/scripts/validate-skill.sh"

# Markdown is hard-wrapped, so a line-based grep splits sentences and both misses
# violations and mis-reads the exclusion markers that sit on a neighbouring line.
# reflow() joins wrapped prose (and wrapped list items) into one line per block,
# leaving headings, table rows and fences alone, so every check below sees whole
# sentences however the author happened to wrap them.
reflow() {
  cat "$@" 2>/dev/null | awk '
    function flush() { if (buf != "") { print buf; buf = "" } }
    /^[[:space:]]*$/                            { flush(); next }
    /^[[:space:]]*```/                          { flush(); print; next }
    /^#/                                        { flush(); print; next }
    /^[[:space:]]*\|/                           { flush(); print; next }
    /^[[:space:]]*([-*+]|[0-9]+\.)[[:space:]]/  { flush(); buf = $0; next }
                                                { if (buf == "") buf = $0; else buf = buf " " $0 }
    END { flush() }
  '
}

# Every markdown file a skill ships, reflowed. Callers must use `grep -c ... >/dev/null`
# rather than `grep -q`: -q exits on the first match, SIGPIPEs this awk, and under
# `set -o pipefail` that turns a successful match into a failed pipeline.
skill_prose() {
  reflow "$SKILL_DIR"/*.md "$SKILL_DIR"/references/*.md
}

ERRORS=0
CHECKS=0
PASSED=0
SKIPPED=0

pass() {
  CHECKS=$((CHECKS + 1))
  PASSED=$((PASSED + 1))
  echo "  PASS: $1"
}

fail() {
  CHECKS=$((CHECKS + 1))
  ERRORS=$((ERRORS + 1))
  echo "  FAIL: $1"
}

skip() {
  SKIPPED=$((SKIPPED + 1))
  echo "  SKIP: $1"
}

echo "=== TOON Skill Eval Framework ==="
echo "Skill: $SKILL_DIR"
echo ""

# ── Phase 1: Structural Validation ──────────────────────────────────────────
echo "── Phase 1: Structural Validation ──"
if [ -f "$VALIDATE_SCRIPT" ]; then
  if bash "$VALIDATE_SCRIPT" "$SKILL_DIR"; then
    pass "Structural validation passed"
  else
    fail "Structural validation failed (see details above)"
    echo ""
    echo "=== Result: Structural validation failed. TOON compliance checks skipped. ==="
    exit 1
  fi
else
  fail "validate-skill.sh not found at $VALIDATE_SCRIPT"
  echo "Cannot run structural validation without the pipeline script."
  echo ""
  echo "=== Result: Missing dependency. ==="
  exit 1
fi

echo ""

# ── Phase 2: TOON Compliance Assertions ─────────────────────────────────────
echo "── Phase 2: TOON Compliance Assertions ──"

# Classification detection
IS_WRITE=false
IS_READ=false

# Check for write-capable indicators. The retired APIs are listed too, so a skill
# that still teaches them is classified write-capable and fails assertion 1 rather
# than being silently skipped.
if skill_prose | grep -c 'client\.send(\|routePrice\|chargeFor\|publishEvent\|signBalanceProof' >/dev/null; then
  IS_WRITE=true
fi

# Check for read-capable indicators. Reads on TOON are free and speak plain NIP-01,
# so a read-capable skill is one that talks about subscribing or querying a relay.
if skill_prose | grep -ci 'NIP-01\|\bREQ\b\|EOSE\|subscribe\|subscription\|free to read\|reads are free' >/dev/null; then
  IS_READ=true
fi

if [ "$IS_WRITE" = true ] && [ "$IS_READ" = true ]; then
  CLASSIFICATION="both"
elif [ "$IS_WRITE" = true ]; then
  CLASSIFICATION="write-capable"
elif [ "$IS_READ" = true ]; then
  CLASSIFICATION="read-capable"
else
  CLASSIFICATION="general"
fi

echo "Classification: $CLASSIFICATION"
echo ""

# A "retirement marker": wording that shows a line NAMES a dead term in order to
# bury it, rather than teaching it. Kept in ONE place because it is consulted by
# three separate checks below, and two copies of it drifted apart once already.
# Plain negations ("there is no basePricePerByte", "none of which exist") are as
# much a retirement as the word "removed", and omitting them failed skills for
# writing the correction in ordinary English.
RETIRED_MARKER='removed|retired|no longer|not exist|none of|deleted|never|\bno\b|used to|gone|dropped|instead of|rather than'

# Assertion 1: toon-write-check (write-capable only)
echo "[1/6] toon-write-check"
if [ "$IS_WRITE" = true ]; then
  WRITE_OK=true
  # Check client.send() is the taught write path
  if ! skill_prose | grep -c 'client\.send(' >/dev/null; then
    WRITE_OK=false
  fi
  # Check no raw-WebSocket EVENT WRITE.
  #
  # The hazard is a skill teaching `ws.send(JSON.stringify(["EVENT", ev]))`
  # instead of client.send(). It is NOT the string `["EVENT"` on its own:
  # since the read model was corrected, a skill is EXPECTED to quote the
  # relay's plain NIP-01 read response, which is literally
  # `["EVENT", <sub-id>, {...}]`. Matching the bare token failed eleven
  # skills for documenting the read shape correctly -- the check punished
  # the fix it was meant to protect.
  #
  # So: fail only when an EVENT array shares a line with a send/publish
  # verb, which is what a raw write actually looks like.
  BARE_EVENT=$(skill_prose | grep -i '\["EVENT"' \
    | grep -Ei '\.send\(|JSON\.stringify|websocket|ws\.|publish|POST ' \
    | grep -vi 'client\.send\(' || true)
  if [ -n "$BARE_EVENT" ]; then
    WRITE_OK=false
  fi
  # Check no retired client APIs. publishEvent() and a caller-facing
  # signBalanceProof() do not exist; a skill naming them tells an agent to call
  # nothing. A line that explicitly marks them removed is allowed.
  RETIRED_API=$(skill_prose | grep -i 'publishEvent\|signBalanceProof' \
    | grep -vEi "$RETIRED_MARKER" || true)
  if [ -n "$RETIRED_API" ]; then
    WRITE_OK=false
  fi
  if [ "$WRITE_OK" = true ]; then
    pass "toon-write-check: client.send() referenced, no bare EVENT patterns, no retired APIs"
  else
    fail "toon-write-check: missing client.send(), bare EVENT pattern, or retired publishEvent/signBalanceProof found"
  fi
else
  skip "toon-write-check: not applicable (not write-capable)"
fi

# Assertion 2: toon-fee-check (write-capable only)
echo "[2/6] toon-fee-check"
if [ "$IS_WRITE" = true ]; then
  FEE_OK=true
  # The skill must tell the agent to ASK the node what a route costs.
  if ! skill_prose | grep -ci 'routePrice\|chargeFor\|GET /ilp\|self-description\|greeting' >/dev/null; then
    FEE_OK=false
  fi
  # It must not invent a per-byte rate. A line that explicitly marks the term
  # removed is allowed.
  PER_BYTE=$(skill_prose | grep -i 'basePricePerByte\|feePerByte\|per-byte\|per byte' \
    | grep -vEi "$RETIRED_MARKER" || true)
  if [ -n "$PER_BYTE" ]; then
    FEE_OK=false
  fi
  if [ "$FEE_OK" = true ]; then
    pass "toon-fee-check: price is asked for (routePrice/chargeFor/self-description), no invented per-byte rate"
  else
    fail "toon-fee-check: no price-discovery terms found, or an invented per-byte rate is taught"
  fi
else
  skip "toon-fee-check: not applicable (not write-capable)"
fi

# Assertion 3: toon-read-check (read-capable only)
echo "[3/6] toon-read-check"
if [ "$IS_READ" = true ]; then
  READ_OK=true
  # Presence: the skill documents the read model at all -- either in the corrected
  # words, or with a TOON-encoding reference (which is legitimate when it is about
  # the sealed write payload; the negative guard below is what separates the two).
  if ! skill_prose | grep -ci 'plain NIP-01\|reads are free\|free to read\|free read\|TOON[- ]format' >/dev/null; then
    READ_OK=false
  fi
  # Negative guard: the false read model. A skill claiming relay reads come back
  # TOON-encoded fails mechanically, exactly as a removed API does. A line that
  # explicitly marks the claim false is allowed.
  #
  # Match the HALLMARKS of the false model, not the token `TOON-format`.
  #
  # A generic negation exemption cannot work here, because the false sentence
  # contains one: "TOON relays return TOON-format strings in EVENT messages,
  # **not** standard JSON objects." Its "not" negates *JSON*, while correct
  # prose negates *TOON* ("Relay responses are standard JSON, not TOON-format
  # strings"). Exempting on `not` therefore passed the false claim and failed
  # the true one -- both, at different times, during this sweep.
  #
  # So key on what only the false model ever says: it DENIES standard JSON, or
  # it instructs a decode. Correct prose asserts standard JSON positively and
  # never instructs one. Verified against both phrasings and all 33 skills.
  FALSE_READ_MODEL=$(skill_prose | grep -Ei 'not standard JSON|use the TOON decoder|using the TOON decoder|decode the TOON-format|TOON-format response using' || true)
  if [ -n "$FALSE_READ_MODEL" ]; then
    READ_OK=false
  fi
  if [ "$READ_OK" = true ]; then
    pass "toon-read-check: read model documented, no TOON-encoded-response claim"
  else
    fail "toon-read-check: read model not documented, or relay responses claimed to be TOON-encoded (TOON decoder / TOON-format strings)"
  fi
else
  skip "toon-read-check: not applicable (not read-capable)"
fi

# Assertion 4: social-context-check (all)
echo "[4/6] social-context-check"
if grep -q '^## Social Context' "$SKILL_DIR/SKILL.md"; then
  # Count words in Social Context section
  SC_WORDS=$(awk '/^## Social Context/{found=1; next} found && /^## /{exit} found{print}' "$SKILL_DIR/SKILL.md" | wc -w | tr -d ' ')
  if [ "$SC_WORDS" -ge 30 ]; then
    pass "social-context-check: Social Context section found ($SC_WORDS words)"
  else
    fail "social-context-check: Social Context section too short ($SC_WORDS words, need >= 30)"
  fi
else
  fail "social-context-check: ## Social Context section missing"
fi

# Assertion 5: trigger-coverage (all)
echo "[5/6] trigger-coverage"
DESCRIPTION=$(awk '/^---$/{n++; next} n==1 && /^description:/{sub(/^description: */, ""); p=1; print; next} n==1 && p && /^[a-zA-Z][a-zA-Z0-9_-]*:/{p=0} n==1 && p{print} n>=2{exit}' "$SKILL_DIR/SKILL.md")

HAS_PROTOCOL=false
HAS_SOCIAL=false

# Protocol-technical indicators
if echo "$DESCRIPTION" | grep -qi 'kind:[0-9]\|NIP-[0-9]\|client.send\|event\|relay\|subscribe\|compliance\|eval\|benchmark\|validation\|grading'; then
  HAS_PROTOCOL=true
fi

# Social-situation indicators (question-form triggers, user-facing scenarios)
if echo "$DESCRIPTION" | grep -qi 'should I\|when to\|appropriate\|how should\|is it okay\|ready for\|is this skill\|measure\|compare\|effectiveness\|how do I\|how to\|how much\|what is\|what are'; then
  HAS_SOCIAL=true
fi

if [ "$HAS_PROTOCOL" = true ] && [ "$HAS_SOCIAL" = true ]; then
  pass "trigger-coverage: both protocol-technical and social-situation triggers found"
else
  DETAIL=""
  if [ "$HAS_PROTOCOL" = false ]; then DETAIL="missing protocol-technical triggers"; fi
  if [ "$HAS_SOCIAL" = false ]; then DETAIL="${DETAIL:+$DETAIL, }missing social-situation triggers"; fi
  fail "trigger-coverage: $DETAIL"
fi

# Assertion 6: eval-completeness (all)
echo "[6/6] eval-completeness"
EVALS_FILE="$SKILL_DIR/evals/evals.json"
if [ -f "$EVALS_FILE" ]; then
  # Parse all eval counts in a single node invocation (avoid spawning 5 processes)
  EVAL_COUNTS=$(node -e "
    const d = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
    const te = d.trigger_evals || [];
    const oe = d.output_evals || [];
    console.log([
      te.length,
      te.filter(e => e.should_trigger === true).length,
      te.filter(e => e.should_trigger === false).length,
      oe.length,
      oe.filter(e => Array.isArray(e.assertions) && e.assertions.length > 0).length
    ].join(' '));
  " "$EVALS_FILE" 2>/dev/null || echo "0 0 0 0 0")

  TRIGGER_COUNT=$(echo "$EVAL_COUNTS" | awk '{print $1}')
  TRIGGER_TRUE=$(echo "$EVAL_COUNTS" | awk '{print $2}')
  TRIGGER_FALSE=$(echo "$EVAL_COUNTS" | awk '{print $3}')
  OUTPUT_COUNT=$(echo "$EVAL_COUNTS" | awk '{print $4}')
  OUTPUT_WITH_ASSERTIONS=$(echo "$EVAL_COUNTS" | awk '{print $5}')

  EVAL_OK=true
  EVAL_DETAIL=""

  if [ "$TRIGGER_COUNT" -lt 6 ]; then
    EVAL_OK=false
    EVAL_DETAIL="trigger_evals=$TRIGGER_COUNT (need >= 6)"
  fi
  if [ "$TRIGGER_TRUE" -lt 1 ] || [ "$TRIGGER_FALSE" -lt 1 ]; then
    EVAL_OK=false
    EVAL_DETAIL="${EVAL_DETAIL:+$EVAL_DETAIL, }no mix of should_trigger true/false (true=$TRIGGER_TRUE, false=$TRIGGER_FALSE)"
  fi
  if [ "$OUTPUT_COUNT" -lt 4 ]; then
    EVAL_OK=false
    EVAL_DETAIL="${EVAL_DETAIL:+$EVAL_DETAIL, }output_evals=$OUTPUT_COUNT (need >= 4)"
  fi
  if [ "$OUTPUT_WITH_ASSERTIONS" -lt "$OUTPUT_COUNT" ]; then
    EVAL_OK=false
    EVAL_DETAIL="${EVAL_DETAIL:+$EVAL_DETAIL, }$((OUTPUT_COUNT - OUTPUT_WITH_ASSERTIONS)) output evals missing assertions"
  fi

  if [ "$EVAL_OK" = true ]; then
    pass "eval-completeness: $TRIGGER_COUNT trigger evals (true=$TRIGGER_TRUE, false=$TRIGGER_FALSE), $OUTPUT_COUNT output evals (all with assertions)"
  else
    fail "eval-completeness: $EVAL_DETAIL"
  fi
else
  fail "eval-completeness: evals/evals.json not found"
fi

echo ""
echo "=== TOON Compliance Result ==="
echo "Classification: $CLASSIFICATION"
echo "Checks: $PASSED passed, $ERRORS failed, $SKIPPED skipped (of $CHECKS run)"

if [ "$ERRORS" -gt 0 ]; then
  echo "Status: FAIL"
  exit 1
else
  echo "Status: PASS"
  exit 0
fi
