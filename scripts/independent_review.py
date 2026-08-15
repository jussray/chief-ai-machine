#!/usr/bin/env python3
"""Deterministic read-only diff reviewer for Chief AI.

This is intentionally not a semantic or merge-authorizing reviewer. It inspects
added lines in a unified diff, emits bounded machine-readable findings, and can
be combined with independent semantic reviewers by the Chief AI orchestrator.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


@dataclass(frozen=True)
class Rule:
    rule_id: str
    severity: str
    title: str
    pattern: re.Pattern[str]
    recommendation: str


BUILTIN_RULES = (
    Rule(
        "secret-literal",
        "P1",
        "Possible credential or secret literal added",
        re.compile(r"(?i)\b(api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password)\b\s*[:=]\s*['\"][^'\"]{8,}['\"]"),
        "Move the value to the repository's secret/provider authority path and keep only a reference in source.",
    ),
    Rule(
        "python-shell-true",
        "P1",
        "Python subprocess enables shell execution",
        re.compile(r"\bshell\s*=\s*True\b"),
        "Avoid shell=True; pass an argument vector to subprocess and validate every externally influenced argument.",
    ),
    Rule(
        "tls-verify-disabled",
        "P1",
        "TLS certificate verification is disabled",
        re.compile(r"\bverify\s*=\s*False\b"),
        "Keep certificate verification enabled and repair the trust configuration instead.",
    ),
    Rule(
        "dynamic-eval",
        "P1",
        "Dynamic code evaluation added",
        re.compile(r"(?:\beval\s*\(|\bnew\s+Function\s*\(|\bFunction\s*\()"),
        "Replace dynamic evaluation with an explicit parser/dispatch table.",
    ),
    Rule(
        "node-shell-exec",
        "P1",
        "Node shell command execution added",
        re.compile(r"\b(?:exec|execSync)\s*\("),
        "Prefer spawn/execFile with an argument vector and a strict command allowlist.",
    ),
    Rule(
        "destructive-sql",
        "P1",
        "Destructive SQL statement added",
        re.compile(r"(?i)\b(?:DROP\s+(?:TABLE|DATABASE)|TRUNCATE\s+TABLE)\b"),
        "Require an explicit migration/rollback gate and prove the target scope before destructive SQL is allowed.",
    ),
    Rule(
        "direct-main-push",
        "P1",
        "Direct push to main-like branch added",
        re.compile(r"\bgit\s+push\b[^\n]*(?:\bmain\b|\bmaster\b)"),
        "Route integration through the repository authority/approval path instead of direct branch writes.",
    ),
    Rule(
        "dangerous-html",
        "P2",
        "Raw HTML injection surface added",
        re.compile(r"\bdangerouslySetInnerHTML\b|\.innerHTML\s*="),
        "Use text/DOM construction or a proven sanitizer and add an XSS regression test.",
    ),
)

HUNK = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@")
MAX_FINDINGS = 100
MAX_POLICY_RULES = 100
MAX_POLICY_PATTERN_LENGTH = 1000


def load_policy(path: str | None) -> list[Rule]:
    if not path:
        return []
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("Review policy must be a JSON object")
    raw_rules = data.get("forbiddenPatterns", [])
    if not isinstance(raw_rules, list):
        raise ValueError("forbiddenPatterns must be an array")
    if len(raw_rules) > MAX_POLICY_RULES:
        raise ValueError(f"Review policy exceeds {MAX_POLICY_RULES} forbidden patterns")

    rules: list[Rule] = []
    seen_rule_ids: set[str] = set()
    for item in raw_rules:
        if not isinstance(item, dict):
            raise ValueError("Each forbiddenPatterns entry must be an object")
        rule_id = str(item.get("id", "")).strip()
        severity = str(item.get("severity", "P2")).strip().upper()
        title = str(item.get("title", rule_id)).strip()
        pattern = str(item.get("pattern", ""))
        recommendation = str(item.get("recommendation", "Review and remove the forbidden pattern.")).strip()
        if not rule_id or severity not in {"P0", "P1", "P2", "P3"} or not pattern:
            raise ValueError("Invalid forbiddenPatterns entry in review policy")
        if rule_id in seen_rule_ids:
            raise ValueError(f"Duplicate review policy rule id: {rule_id}")
        if len(pattern) > MAX_POLICY_PATTERN_LENGTH:
            raise ValueError(f"Review policy pattern exceeds {MAX_POLICY_PATTERN_LENGTH} characters: {rule_id}")
        seen_rule_ids.add(rule_id)
        rules.append(Rule(rule_id, severity, title, re.compile(pattern), recommendation))
    return rules


def added_lines(diff_text: str) -> Iterable[tuple[str, int, str]]:
    path = ""
    new_line = 0
    for raw in diff_text.splitlines():
        if raw.startswith("+++ b/"):
            path = raw[6:]
            continue
        match = HUNK.match(raw)
        if match:
            new_line = int(match.group(1))
            continue
        if raw.startswith("+") and not raw.startswith("+++"):
            yield path, new_line, raw[1:]
            new_line += 1
        elif raw.startswith("-") and not raw.startswith("---"):
            continue
        elif path and not raw.startswith("\\"):
            new_line += 1


def finding_id(rule_id: str, path: str, line: int, text: str) -> str:
    digest = hashlib.sha256(f"{rule_id}\0{path}\0{line}\0{text}".encode()).hexdigest()[:12]
    return f"py-{rule_id}-{digest}"


def line_fingerprint(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()[:16]


def analyze(diff_text: str, rules: Iterable[Rule]) -> list[dict]:
    findings: list[dict] = []
    seen: set[tuple[str, str, int]] = set()
    for path, line, text in added_lines(diff_text):
        for rule in rules:
            if not rule.pattern.search(text):
                continue
            key = (rule.rule_id, path, line)
            if key in seen:
                continue
            seen.add(key)
            findings.append(
                {
                    "id": finding_id(rule.rule_id, path, line, text),
                    "severity": rule.severity,
                    "title": rule.title,
                    "path": path,
                    "line": line if line > 0 else None,
                    "evidence": (
                        f"Added line at {path or '<unknown>'}:{line if line > 0 else '?'} "
                        f"matched deterministic rule {rule.rule_id}; "
                        f"line_sha256_prefix={line_fingerprint(text)}"
                    ),
                    "recommendation": rule.recommendation,
                }
            )
            if len(findings) > MAX_FINDINGS:
                raise ValueError(
                    f"Deterministic findings exceed {MAX_FINDINGS}; review must be split or consolidated without dropping evidence"
                )
    findings.sort(key=lambda item: (item["severity"], item["path"], item["line"] or 0, item["id"]))
    return findings


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--diff", help="Unified diff file. Reads stdin when omitted.")
    parser.add_argument("--policy", help="Optional JSON policy with forbiddenPatterns.")
    args = parser.parse_args()

    diff_text = Path(args.diff).read_text(encoding="utf-8") if args.diff else sys.stdin.read()
    try:
        rules = [*BUILTIN_RULES, *load_policy(args.policy)]
        findings = analyze(diff_text, rules)
    except (OSError, ValueError, json.JSONDecodeError, re.error) as exc:
        print(json.dumps({"ok": False, "error": str(exc)}))
        return 2

    print(
        json.dumps(
            {
                "ok": True,
                "reviewer": {
                    "id": "python-static-review-v1",
                    "kind": "deterministic",
                    "provider": "python",
                    "runtime": f"python-{sys.version_info.major}.{sys.version_info.minor}",
                },
                "findings": findings,
                "semanticReviewSatisfied": False,
                "mergeAuthorized": False,
                "executionAuthorized": False,
            },
            separators=(",", ":"),
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
