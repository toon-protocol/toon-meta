#!/usr/bin/env bash
# Copies the AFK factory template into the current repo, creates the triage labels, and
# checks what the factory needs from GitHub. Nothing here commits or pushes.
#
# The template is templates/factory/ in toon-protocol/toon-meta. It is read from the
# checkout this script sits in (a toon-meta clone, or the installed toon-skills plugin),
# so the script and the template are always the same version. A copy of this script with
# no template beside it fetches toon-meta's main instead.
#
# Usage: bootstrap.sh [--force]     --force overwrites factory files already present
# Env:   FACTORY_SRC   a template directory to use instead
set -euo pipefail

TEMPLATE_REPO=toon-protocol/toon-meta
TEMPLATE_PATH=templates/factory
PLACEHOLDER=__REPO__
force=0
[ "${1:-}" = "--force" ] && force=1

LABELS=(
  'needs-triage|FBCA04|Maintainer needs to evaluate this issue'
  'needs-info|D876E3|Waiting on reporter for more information'
  'ready-for-agent|0E8A16|Fully specified, ready for an AFK agent'
  'ready-for-human|1D76DB|Requires human implementation'
  'wontfix|ffffff|This will not be worked on'
)
SECRETS=(APP_ID APP_PRIVATE_KEY CLAUDE_CODE_OAUTH_TOKEN)
WORKFLOWS=(agent-implement.yml close-linked-issues.yml)

warnings=0
warn() { echo "WARN: $*"; warnings=$((warnings + 1)); }
# sandcastle names its image after the checkout directory, lowercased and sanitized.
image_tag() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9_.-]/-/g'; }

here=$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")
cd "$(git rev-parse --show-toplevel)"
repo=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
default_branch=$(gh repo view --json defaultBranchRef --jq .defaultBranchRef.name)
tag=$(image_tag "${repo#*/}")

# --- files -------------------------------------------------------------------------
existing=()
[ -e .sandcastle ] && existing+=(.sandcastle)
for w in "${WORKFLOWS[@]}"; do
  [ -e ".github/workflows/$w" ] && existing+=(".github/workflows/$w")
done
if [ "${#existing[@]}" -gt 0 ] && [ "$force" -eq 0 ]; then
  echo "ERROR: already present: ${existing[*]}"
  echo "       This repo may already have a factory. Re-run with --force to overwrite."
  exit 1
fi

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
if [ -n "${FACTORY_SRC:-}" ]; then
  src=$FACTORY_SRC
elif [ -d "$here/../../$TEMPLATE_PATH/.sandcastle" ]; then
  src=$(cd "$here/../../$TEMPLATE_PATH" && pwd)
else
  gh api "repos/$TEMPLATE_REPO/tarball/main" | tar -xz -C "$tmp" --strip-components=1
  src=$tmp/$TEMPLATE_PATH
fi
echo "bootstrap: $repo, from $src"
for f in .sandcastle/agent-implement-issue.ts "${WORKFLOWS[@]/#/.github/workflows/}"; do
  [ -f "$src/$f" ] || { echo "ERROR: the template at $src has no $f"; exit 1; }
done

mkdir -p .sandcastle .github/workflows
# Not cp -a: a template someone ran `npm ci` in must not hand over its node_modules.
tar -C "$src/.sandcastle" --exclude=node_modules --exclude=logs --exclude=worktrees --exclude=.env -cf - . |
  tar -C .sandcastle -xf -
cp "$src/.github/workflows/close-linked-issues.yml" .github/workflows/
sed "s/$PLACEHOLDER/$tag/g" "$src/.github/workflows/agent-implement.yml" > .github/workflows/agent-implement.yml
grep -q "sandcastle:$tag" .github/workflows/agent-implement.yml ||
  warn "agent-implement.yml does not tag the image 'sandcastle:$tag'. The template changed shape; fix the tag by hand."
echo "files: .sandcastle/ and ${WORKFLOWS[*]} copied"

# --- labels ------------------------------------------------------------------------
have=$(gh label list -R "$repo" --limit 200 --json name --jq '.[].name')
for entry in "${LABELS[@]}"; do
  IFS='|' read -r label color description <<<"$entry"
  if grep -qxF "$label" <<<"$have"; then
    echo "label: $label exists"
  else
    gh label create "$label" -R "$repo" --color "$color" --description "$description" >/dev/null
    echo "label: $label created"
  fi
done

# --- what the workflows need from GitHub --------------------------------------------
[ "$default_branch" = main ] ||
  warn "default branch is '$default_branch', but the runner hardcodes BASE = 'main' (agent-implement-issue.ts)."

visible=$({
  gh api "repos/$repo/actions/organization-secrets" --paginate --jq '.secrets[].name' 2>/dev/null || true
  gh api "repos/$repo/actions/secrets" --paginate --jq '.secrets[].name' 2>/dev/null || true
})
if [ -z "$visible" ]; then
  warn "could not list this repo's secrets (needs repo admin). Unverified: ${SECRETS[*]}"
else
  for s in "${SECRETS[@]}"; do
    if grep -qxF "$s" <<<"$visible"; then echo "secret: $s visible"; else warn "secret $s is not visible to $repo"; fi
  done
fi

apps=$(gh api "orgs/${repo%/*}/installations" \
  --jq '[.installations[] | "\(.app_slug) (\(.repository_selection))"] | join(", ")' 2>/dev/null || true)
if [ -n "$apps" ]; then
  echo "apps installed on ${repo%/*}: $apps"
  echo "  The App behind APP_ID must cover this repo: 'all', or 'selected' with this repo added."
else
  warn "could not list GitHub App installations for ${repo%/*}. Unverified: the App behind APP_ID covers $repo."
fi

# --- the runner's own checks --------------------------------------------------------
npm ci --prefix .sandcastle --silent --no-audit --no-fund
if (cd .sandcastle && npm test --if-present --silent >/dev/null 2>&1 && npm run typecheck --if-present --silent >/dev/null 2>&1); then
  echo "runner: npm ci, test and typecheck pass"
else
  warn "the runner's test or typecheck failed. Run 'npm test' and 'npm run typecheck' in .sandcastle/."
fi

echo "gate, as the runner would read it from .github/workflows/ci.yml in this checkout:"
.sandcastle/node_modules/.bin/tsx -e '
  import { existsSync, readFileSync } from "node:fs";
  import { gateFromCi } from "./.sandcastle/run-gate.ts";
  const path = ".github/workflows/ci.yml";
  const gate = gateFromCi(existsSync(path) ? readFileSync(path, "utf8") : null);
  for (const step of gate.steps) console.log("  runs: " + step.name);
  for (const note of gate.notes) console.log("  note: " + note);
' 2>/dev/null || warn "could not evaluate the gate. Read .sandcastle/run-gate.ts for how it is chosen."

if grep -rIq --exclude-dir=node_modules -e "$PLACEHOLDER" .sandcastle .github/workflows/agent-implement.yml; then
  warn "unfilled $PLACEHOLDER placeholder: $(grep -rIl --exclude-dir=node_modules -e "$PLACEHOLDER" .sandcastle .github/workflows/agent-implement.yml | tr '\n' ' ')"
fi

echo "bootstrap: done, $warnings warning(s)"
