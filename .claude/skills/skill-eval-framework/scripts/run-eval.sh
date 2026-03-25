#!/usr/bin/env bash
# run-eval.sh — Run structural validation + TOON compliance assertions on a skill
# Usage: ./run-eval.sh <path-to-skill-directory>
# Exit 0 = all checks pass, 1 = at least one check failed
# Dependencies: bash, grep, awk, wc, node (for JSON validation)

set -euo pipefail

SKILL_DIR="${1:?Usage: run-eval.sh <skill-directory>}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
VALIDATE_SCRIPT="$PROJECT_ROOT/.claude/skills/nip-to-toon-skill/scripts/validate-skill.sh"

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

# Check for write-capable indicators
if grep -rq 'publishEvent' "$SKILL_DIR"/*.md "$SKILL_DIR"/references/*.md 2>/dev/null; then
  IS_WRITE=true
fi

# Check for read-capable indicators
if grep -rqi 'TOON[- ]format\|toon-format\|TOON format' "$SKILL_DIR"/*.md "$SKILL_DIR"/references/*.md 2>/dev/null; then
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

# Assertion 1: toon-write-check (write-capable only)
echo "[1/6] toon-write-check"
if [ "$IS_WRITE" = true ]; then
  WRITE_OK=true
  # Check publishEvent is referenced
  if ! grep -rq 'publishEvent' "$SKILL_DIR"/*.md "$SKILL_DIR"/references/*.md 2>/dev/null; then
    WRITE_OK=false
  fi
  # Check no bare EVENT array patterns
  BARE_EVENT=$(grep -rl '\["EVENT"' "$SKILL_DIR"/*.md "$SKILL_DIR"/references/*.md 2>/dev/null || true)
  if [ -n "$BARE_EVENT" ]; then
    WRITE_OK=false
  fi
  if [ "$WRITE_OK" = true ]; then
    pass "toon-write-check: publishEvent referenced, no bare EVENT patterns"
  else
    fail "toon-write-check: missing publishEvent or bare EVENT pattern found"
  fi
else
  skip "toon-write-check: not applicable (not write-capable)"
fi

# Assertion 2: toon-fee-check (write-capable only)
echo "[2/6] toon-fee-check"
if [ "$IS_WRITE" = true ]; then
  if grep -rqi 'basePricePerByte\|fee calculation\|fee awareness\|publishing fee\|event fee\|pay.*to.*write\|ILP.*payment\|cost.*per.*byte\|pricing model' "$SKILL_DIR"/*.md "$SKILL_DIR"/references/*.md 2>/dev/null; then
    pass "toon-fee-check: fee-related terms found"
  else
    fail "toon-fee-check: no fee-related terms found"
  fi
else
  skip "toon-fee-check: not applicable (not write-capable)"
fi

# Assertion 3: toon-format-check (read-capable only)
echo "[3/6] toon-format-check"
if [ "$IS_READ" = true ]; then
  if grep -rqi 'TOON[- ]format\|toon-format\|TOON format' "$SKILL_DIR"/*.md "$SKILL_DIR"/references/*.md 2>/dev/null; then
    pass "toon-format-check: TOON format reference found"
  else
    fail "toon-format-check: no TOON format reference found"
  fi
else
  skip "toon-format-check: not applicable (not read-capable)"
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
if echo "$DESCRIPTION" | grep -qi 'kind:[0-9]\|NIP-[0-9]\|publishEvent\|event\|relay\|subscribe\|compliance\|eval\|benchmark\|validation\|grading'; then
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
