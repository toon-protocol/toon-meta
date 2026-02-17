#!/usr/bin/env bash
# scaffold-handler.sh — Generate a new NIP handler reference file from template
#
# Usage:
#   ./scaffold-handler.sh <kind-number> <handler-name> [nip-number]
#
# Examples:
#   ./scaffold-handler.sh 4 encrypted-dm 04
#   ./scaffold-handler.sh 9735 zap-receipt 57
#   ./scaffold-handler.sh 30023 long-form-article 23
#
# Creates: references/handlers/kind-{N}-{name}.md

set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE="${SKILL_DIR}/references/handler-template.md"
HANDLERS_DIR="${SKILL_DIR}/references/handlers"

if [ $# -lt 2 ]; then
    echo "Usage: $0 <kind-number> <handler-name> [nip-number]"
    echo ""
    echo "Examples:"
    echo "  $0 4 encrypted-dm 04"
    echo "  $0 9735 zap-receipt 57"
    echo "  $0 30023 long-form-article 23"
    exit 1
fi

KIND="$1"
NAME="$2"
NIP="${3:-XX}"

OUTPUT_FILE="${HANDLERS_DIR}/kind-${KIND}-${NAME}.md"

if [ -f "${OUTPUT_FILE}" ]; then
    echo "Error: Handler already exists: ${OUTPUT_FILE}"
    exit 1
fi

if [ ! -f "${TEMPLATE}" ]; then
    echo "Error: Template not found: ${TEMPLATE}"
    exit 1
fi

mkdir -p "${HANDLERS_DIR}"

# Generate handler from template
TITLE_NAME=$(echo "${NAME}" | sed 's/-/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2))}1')

# Strip the template header (lines before the --- separator) and apply substitutions
sed -n '/^---$/,$p' "${TEMPLATE}" | tail -n +2 | sed \
    -e "s/{N}/${KIND}/g" \
    -e "s/{Name}/${TITLE_NAME}/g" \
    -e "s/{XX}/${NIP}/g" \
    > "${OUTPUT_FILE}"

echo "Created handler: ${OUTPUT_FILE}"
echo ""
echo "Next steps:"
echo "  1. Edit ${OUTPUT_FILE} to fill in event structure, processing logic, and examples"
echo "  2. Add entry to references/kind-registry.md"
echo "  3. Update action-schema.md if new action types are needed"
