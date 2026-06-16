#!/usr/bin/env python3
"""grade-output.py — Grade agent output against assertions, produce grading.json.

Usage:
    python3 grade-output.py --response <file> --assertions <file>
    python3 grade-output.py --response <file> --assertions-json '["assertion1", "assertion2"]'

Output: grading.json to stdout

Each assertion is checked via:
1. Case-insensitive substring search for key terms
2. Negation detection (NOT, does not, never)
3. Concept matching for reasoning indicators

No external dependencies (Python 3 stdlib only).
"""

import argparse
import json
import re
import sys


def extract_key_terms(assertion_text):
    """Extract key terms from an assertion for matching."""
    # Remove common assertion prefixes like "toon-write-check:"
    text = re.sub(r'^[a-z-]+:\s*', '', assertion_text, flags=re.IGNORECASE)

    # Extract quoted strings as exact terms
    quoted = re.findall(r"'([^']+)'|\"([^\"]+)\"", text)
    exact_terms = [q[0] or q[1] for q in quoted]

    # Extract technical terms (camelCase, snake_case, @-prefixed, dotted paths)
    technical = re.findall(
        r'@[\w/-]+(?:/[\w-]+)*'  # @toon-protocol/client
        r'|\b[a-z]+[A-Z]\w+'    # publishEvent, basePricePerByte (word boundary)
        r'|\b[A-Z][a-z]+[A-Z]\w+'  # WebSocket (PascalCase with inner caps)
        r'|\w+_\w+'             # snake_case
        r'|\b[A-Z]{2,}\b'      # TOON, EVENT, JSON (whole words only)
        , text
    )

    # Extract domain-specific single keywords that are strong signal
    domain_keywords = re.findall(
        r'\b(?:fee|cost|pricing|payment|format|compliance|assertion|grading|benchmark)\b',
        text, re.IGNORECASE
    )
    # Deduplicate while preserving order
    seen = set()
    unique_domain = []
    for kw in domain_keywords:
        if kw.lower() not in seen:
            seen.add(kw.lower())
            unique_domain.append(kw)

    return exact_terms + technical + unique_domain


def is_negation_assertion(assertion_text):
    """Check if the assertion is checking for absence."""
    negation_patterns = [
        r'Response does NOT\b',
        r'Response does not\b',
        r'Response should not\b',
        r'Response never\b',
        r'\bno bare\b',
        r'does NOT use\b',
        r'does NOT contain\b',
        r'does NOT recommend\b',
        r'does not use\b',
        r'does not contain\b',
        r'does not recommend\b',
    ]
    for pattern in negation_patterns:
        if re.search(pattern, assertion_text, re.IGNORECASE):
            return True
    return False


def extract_negation_target(assertion_text):
    """Extract what should NOT be present."""
    # Common patterns: "does NOT use X", "does not contain X"
    patterns = [
        r'NOT\s+(?:use|contain|mention|recommend|suggest)\s+(.+?)(?:\.|$)',
        r'does not\s+(?:use|contain|mention|recommend|suggest)\s+(.+?)(?:\.|$)',
        r'never\s+(?:use|contain|mention|recommend|suggest)\s+(.+?)(?:\.|$)',
    ]
    for pattern in patterns:
        match = re.search(pattern, assertion_text, re.IGNORECASE)
        if match:
            return match.group(1).strip()
    return None


def check_reasoning_indicators(response_text):
    """Check if the response contains reasoning/explanation indicators."""
    indicators = [
        r'\bbecause\b',
        r'\bthe reason\b',
        r'\bthis is why\b',
        r'\bthis matters because\b',
        r'\bin order to\b',
        r'\bso that\b',
        r'\bsince\b',
        r'\btherefore\b',
        r'\bconsequently\b',
        r'\bas a result\b',
        r'\bdue to\b',
    ]
    count = 0
    for indicator in indicators:
        if re.search(indicator, response_text, re.IGNORECASE):
            count += 1
    return count


def grade_assertion(assertion_text, response_text):
    """Grade a single assertion against the response. Returns (passed, evidence)."""
    response_lower = response_text.lower()

    # Handle negation assertions
    if is_negation_assertion(assertion_text):
        target = extract_negation_target(assertion_text)
        if target:
            target_lower = target.lower().strip()
            if target_lower in response_lower:
                return False, f"Found prohibited content '{target}' in response."
            else:
                return True, f"Response correctly does not contain '{target}'."

        # Generic negation: check key terms should NOT be present
        key_terms = extract_key_terms(assertion_text)
        found_terms = [t for t in key_terms if t.lower() in response_lower]
        if found_terms:
            return False, f"Found prohibited terms: {', '.join(found_terms)}"
        else:
            return True, "Response correctly avoids prohibited patterns."

    # Handle reasoning/explanation assertions
    reasoning_keywords = ['explains', 'reasoning', 'why']
    if any(kw.lower() in assertion_text.lower() for kw in reasoning_keywords):
        count = check_reasoning_indicators(response_text)
        if count >= 1:
            return True, f"Response contains {count} reasoning indicator(s)."
        else:
            return False, "Response lacks reasoning indicators (because, since, therefore, etc.)."

    # Standard assertion: check key terms are present
    key_terms = extract_key_terms(assertion_text)

    if key_terms:
        found = []
        missing = []
        for term in key_terms:
            term_lower = term.lower()
            if term_lower in response_lower:
                found.append(term)
            else:
                # For multi-word phrases, check if all individual words appear
                words = term_lower.split()
                if len(words) > 1 and all(w in response_lower for w in words):
                    found.append(term)
                else:
                    missing.append(term)

        if len(found) >= len(key_terms) * 0.5:  # At least 50% of key terms found
            return True, f"Found key terms: {', '.join(found)}."
        else:
            return False, f"Missing key terms: {', '.join(missing)}. Found: {', '.join(found) if found else 'none'}."

    # Fallback: simple keyword extraction from assertion text
    words = re.findall(r'\b[a-z]{4,}\b', assertion_text.lower())
    # Filter out common stop words
    stop_words = {
        'response', 'includes', 'contains', 'mentions', 'should',
        'with', 'that', 'this', 'from', 'have', 'been', 'does',
        'both', 'also', 'each', 'into', 'only', 'very', 'about',
    }
    meaningful = [w for w in words if w not in stop_words]

    if meaningful:
        found = [w for w in meaningful if w in response_lower]
        if len(found) >= len(meaningful) * 0.5:
            return True, f"Found concepts: {', '.join(found)}."
        else:
            missing = [w for w in meaningful if w not in response_lower]
            return False, f"Missing concepts: {', '.join(missing)}."

    return False, "Unable to extract checkable terms from assertion."


def main():
    parser = argparse.ArgumentParser(description='Grade agent output against assertions')
    parser.add_argument('--response', required=True, help='Path to response text file')
    parser.add_argument('--assertions', help='Path to JSON file with assertions array')
    parser.add_argument('--assertions-json', help='Inline JSON array of assertions')
    args = parser.parse_args()

    # Load response
    try:
        with open(args.response, 'r', encoding='utf-8') as f:
            response_text = f.read()
    except FileNotFoundError:
        print(json.dumps({"error": f"Response file not found: {args.response}"}))
        sys.exit(1)

    if not response_text.strip():
        print(json.dumps({"error": "Response file is empty"}))
        sys.exit(1)

    # Load assertions
    if args.assertions_json:
        try:
            assertions = json.loads(args.assertions_json)
        except json.JSONDecodeError as e:
            print(json.dumps({"error": f"Invalid assertions JSON: {e}"}))
            sys.exit(1)
    elif args.assertions:
        try:
            with open(args.assertions, 'r', encoding='utf-8') as f:
                assertions = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError) as e:
            print(json.dumps({"error": f"Failed to load assertions: {e}"}))
            sys.exit(1)
    else:
        print(json.dumps({"error": "Provide --assertions or --assertions-json"}))
        sys.exit(1)

    if not isinstance(assertions, list):
        print(json.dumps({"error": "Assertions must be a JSON array of strings"}))
        sys.exit(1)

    # Grade each assertion
    results = []
    for assertion in assertions:
        if not isinstance(assertion, str):
            results.append({
                "text": str(assertion),
                "passed": False,
                "evidence": "Assertion is not a string."
            })
            continue

        passed, evidence = grade_assertion(assertion, response_text)
        results.append({
            "text": assertion,
            "passed": passed,
            "evidence": evidence
        })

    # Output grading.json
    print(json.dumps(results, indent=2))


if __name__ == '__main__':
    main()
