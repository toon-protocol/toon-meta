#!/usr/bin/env bash
# validate-skill.sh — Lint a pipeline-generated skill directory
# Usage: ./validate-skill.sh <path-to-skill-directory>
# Exit 0 = all checks pass, 1 = at least one check failed

set -euo pipefail

SKILL_DIR="${1:?Usage: validate-skill.sh <skill-directory>}"
ERRORS=0
CHECKS=0
PASSED=0

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

echo "Validating skill: $SKILL_DIR"
echo "---"

# Check 1: SKILL.md exists
echo "[1/8] SKILL.md exists"
if [ -f "$SKILL_DIR/SKILL.md" ]; then
  pass "SKILL.md found"
else
  fail "SKILL.md not found"
  echo "Cannot continue without SKILL.md"
  echo "---"
  echo "Result: $PASSED/$((CHECKS)) checks passed, $ERRORS failed"
  exit 1
fi

# Check 2: YAML frontmatter has name and description
echo "[2/8] YAML frontmatter valid"
FRONTMATTER=$(sed -n '/^---$/,/^---$/p' "$SKILL_DIR/SKILL.md")
if [ -z "$FRONTMATTER" ]; then
  fail "No YAML frontmatter found (missing --- delimiters)"
else
  if echo "$FRONTMATTER" | grep -q '^name:'; then
    pass "Frontmatter has 'name' field"
  else
    fail "Frontmatter missing 'name' field"
  fi

  if echo "$FRONTMATTER" | grep -q '^description:'; then
    pass "Frontmatter has 'description' field"
  else
    fail "Frontmatter missing 'description' field"
  fi

  # Check for forbidden extra fields (only name and description allowed)
  EXTRA_FIELDS=$(echo "$FRONTMATTER" | grep -E '^[a-zA-Z][a-zA-Z0-9_-]*:' | grep -v '^name:' | grep -v '^description:' | grep -v '^---$' || true)
  if [ -n "$EXTRA_FIELDS" ]; then
    fail "Frontmatter has extra fields (only name and description allowed): $EXTRA_FIELDS"
  else
    pass "Frontmatter has only name and description fields"
  fi
fi

# Check 3: references/ directory exists
echo "[3/8] references/ directory exists"
if [ -d "$SKILL_DIR/references" ]; then
  pass "references/ directory found"
else
  fail "references/ directory not found"
fi

# Check 4: evals/evals.json exists and is valid JSON
echo "[4/8] evals/evals.json valid"
if [ -f "$SKILL_DIR/evals/evals.json" ]; then
  pass "evals/evals.json found"
  if node -e "JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'))" "$SKILL_DIR/evals/evals.json" 2>/dev/null; then
    pass "evals/evals.json is valid JSON"
  else
    fail "evals/evals.json is not valid JSON"
  fi
else
  fail "evals/evals.json not found"
fi

# Check 5: ## Social Context section exists in SKILL.md
echo "[5/8] Social Context section"
if grep -q '^## Social Context' "$SKILL_DIR/SKILL.md"; then
  pass "## Social Context section found in SKILL.md"
else
  fail "## Social Context section missing from SKILL.md"
fi

# Check 6: No bare ["EVENT", ...] patterns in any .md file (recursive)
echo "[6/8] No bare EVENT patterns"
BARE_EVENT=$(find "$SKILL_DIR" -name '*.md' -exec grep -l '\["EVENT"' {} + 2>/dev/null || true)
if [ -n "$BARE_EVENT" ]; then
  fail "Bare [\"EVENT\", ...] pattern found in: $BARE_EVENT"
else
  pass "No bare [\"EVENT\", ...] patterns found"
fi

# Check 7: Description length is 50-200 words
echo "[7/8] Description length"
# Extract description from frontmatter — handle multi-line YAML description
DESCRIPTION=$(awk '/^---$/{n++; next} n==1 && /^description:/{sub(/^description: */, ""); p=1; print; next} n==1 && p && /^[a-zA-Z][a-zA-Z0-9_-]*:/{p=0} n==1 && p{print} n>=2{exit}' "$SKILL_DIR/SKILL.md")
WORD_COUNT=$(echo "$DESCRIPTION" | wc -w | tr -d ' ')
if [ "$WORD_COUNT" -ge 50 ] && [ "$WORD_COUNT" -le 200 ]; then
  pass "Description is $WORD_COUNT words (50-200 range)"
else
  fail "Description is $WORD_COUNT words (expected 50-200)"
fi

# Check 8: Body is under 500 lines
echo "[8/8] Body line count"
# Body starts after the second --- delimiter
BODY_LINES=$(awk 'BEGIN{n=0} /^---$/{n++; next} n>=2{print}' "$SKILL_DIR/SKILL.md" | wc -l | tr -d ' ')
if [ "$BODY_LINES" -lt 500 ]; then
  pass "Body is $BODY_LINES lines (under 500)"
else
  fail "Body is $BODY_LINES lines (exceeds 500 limit)"
fi

echo "---"
echo "Result: $PASSED/$CHECKS checks passed, $ERRORS failed"

if [ "$ERRORS" -gt 0 ]; then
  exit 1
else
  exit 0
fi
