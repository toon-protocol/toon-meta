#!/usr/bin/env python3
"""aggregate-benchmark.py — Aggregate eval results into benchmark.json.

Usage:
    python3 aggregate-benchmark.py --workspace <dir>
    python3 aggregate-benchmark.py --workspace workspace/iteration-1

Scans a workspace directory for grading.json and timing.json files,
aggregates pass rate, timing stats, and produces benchmark.json to stdout.

No external dependencies (Python 3 stdlib only).
"""

import argparse
import json
import math
import os
import sys
from datetime import datetime, timezone


def find_grading_files(workspace_dir):
    """Find all grading.json files in the workspace."""
    results = []
    for root, dirs, files in os.walk(workspace_dir):
        if 'grading.json' in files:
            results.append(os.path.join(root, 'grading.json'))
    return results


def find_timing_files(workspace_dir):
    """Find all timing.json files in the workspace."""
    results = []
    for root, dirs, files in os.walk(workspace_dir):
        if 'timing.json' in files:
            results.append(os.path.join(root, 'timing.json'))
    return results


def find_metadata_files(workspace_dir):
    """Find all eval_metadata.json files in the workspace."""
    results = []
    for root, dirs, files in os.walk(workspace_dir):
        if 'eval_metadata.json' in files:
            results.append(os.path.join(root, 'eval_metadata.json'))
    return results


def load_json_safe(filepath):
    """Load a JSON file, returning None on error."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError, PermissionError):
        return None


def compute_stddev(values, mean):
    """Compute population standard deviation."""
    if len(values) == 0:
        return 0.0
    variance = sum((v - mean) ** 2 for v in values) / len(values)
    return math.sqrt(variance)


def main():
    parser = argparse.ArgumentParser(
        description='Aggregate eval results into benchmark.json'
    )
    parser.add_argument(
        '--workspace', required=True,
        help='Path to workspace directory (e.g., workspace/iteration-1)'
    )
    parser.add_argument(
        '--skill-name', default='unknown',
        help='Skill name for metadata (auto-detected from eval_metadata.json if available)'
    )
    args = parser.parse_args()

    workspace = args.workspace
    if not os.path.isdir(workspace):
        print(json.dumps({"error": f"Workspace directory not found: {workspace}"}))
        sys.exit(1)

    # Collect grading results
    grading_files = find_grading_files(workspace)
    if not grading_files:
        print(json.dumps({
            "error": "No grading.json files found in workspace",
            "workspace": workspace
        }))
        sys.exit(1)

    total_assertions = 0
    passed_assertions = 0
    eval_count = 0

    for gf in grading_files:
        data = load_json_safe(gf)
        if data is None:
            continue
        if not isinstance(data, list):
            continue

        eval_count += 1
        for assertion in data:
            if isinstance(assertion, dict) and 'passed' in assertion:
                total_assertions += 1
                if assertion['passed']:
                    passed_assertions += 1

    # Compute pass rate
    pass_rate = 0.0
    if total_assertions > 0:
        pass_rate = round((passed_assertions / total_assertions) * 100, 1)

    # Collect timing data
    timing_files = find_timing_files(workspace)
    durations = []
    for tf in timing_files:
        data = load_json_safe(tf)
        if data and isinstance(data, dict) and 'duration_seconds' in data:
            durations.append(float(data['duration_seconds']))

    timing_mean = 0.0
    timing_stddev = 0.0
    if durations:
        timing_mean = round(sum(durations) / len(durations), 2)
        timing_stddev = round(compute_stddev(durations, timing_mean), 2)

    # Detect skill name from metadata
    skill_name = args.skill_name
    metadata_files = find_metadata_files(workspace)
    for mf in metadata_files:
        data = load_json_safe(mf)
        if data and isinstance(data, dict) and 'skill_name' in data:
            skill_name = data['skill_name']
            break

    # Build benchmark output
    benchmark = {
        "pass_rate": pass_rate,
        "timing": {
            "mean": timing_mean,
            "stddev": timing_stddev
        },
        "token_usage": {
            "prompt": 0,
            "completion": 0
        },
        "metadata": {
            "skill_name": skill_name,
            "eval_count": eval_count,
            "assertion_count": total_assertions,
            "passed_assertions": passed_assertions,
            "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        }
    }

    print(json.dumps(benchmark, indent=2))


if __name__ == '__main__':
    main()
