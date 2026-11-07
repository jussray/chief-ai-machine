#!/usr/bin/env python3
"""Shared evidence/state primitives for ULTRATHINK modes. Stdlib only.

The evidence ledger is deliberately non-authoritative: it records and invalidates
proof, but it cannot grant execution, merge, deploy, production, or acceptance
authority. Runtime/source/dependency identity changes make bound proof stale.
"""
from __future__ import annotations

from datetime import datetime
import re
from typing import Any, Iterable, Mapping, Sequence
from urllib.parse import urlparse

EVIDENCE_LABELS = (
    "VERIFIED", "INFERRED", "PARTIAL", "UNKNOWN", "BLOCKED", "STALE", "DISPROVEN"
)
STATE_ORDER = (
    "PLANNED", "SOURCE IMPLEMENTED", "LOCALLY VERIFIED", "COMMITTED", "PR OPEN",
    "CI VERIFIED", "MERGED", "DEPLOYED", "RUNTIME VERIFIED", "OUTCOME VERIFIED",
)
SOURCE_RANK = {
    "runtime": 90,
    "deployment": 80,
    "branch_sha": 70,
    "artifact": 60,
    "receipt": 50,
    "repo_docs": 40,
    "chat": 20,
    "inference": 10,
}
VERIFY_CAPABLE_SOURCE_KINDS = frozenset({"runtime", "deployment", "branch_sha", "artifact"})
NON_AUTHORITATIVE_SOURCE_KINDS = frozenset({"receipt", "repo_docs", "chat", "inference"})
RECEIPT_ID = re.compile(r"^[A-Z][A-Z0-9_-]{2,127}$")
SHA_40 = re.compile(r"^[a-f0-9]{40}$", re.IGNORECASE)
SHA_64 = re.compile(r"^[a-f0-9]{64}$", re.IGNORECASE)
VALID_RUNTIME_ENVS = frozenset({"local", "preview", "staging", "production"})
VALID_PACKAGE_MANAGERS = frozenset({"npm", "pnpm", "yarn", "bun", "unknown"})
NON_AUTHORITATIVE_MARKERS = frozenset({"cookie", "fingerprint", "local-storage", "session-storage"})
NON_AUTHORITATIVE_REF_SCHEMES = frozenset({"cookie", "fingerprint", "local-storage", "session-storage", "receipt"})


def normalize_label(value: str | None) -> str:
    label = (value or "UNKNOWN").strip().upper()
    if label not in EVIDENCE_LABELS:
        raise ValueError(f"unsupported evidence label: {value!r}")
    return label


def normalize_state(value: str | None) -> str:
    state = (value or "PLANNED").strip().upper()
    if state not in STATE_ORDER:
        raise ValueError(f"unsupported lifecycle state: {value!r}")
    return state


def state_exceeds(claimed: str, proven: str) -> bool:
    return STATE_ORDER.index(normalize_state(claimed)) > STATE_ORDER.index(normalize_state(proven))


def evidence_strength(evidence: Mapping[str, Any]) -> int:
    base = SOURCE_RANK.get(str(evidence.get("source_kind", "inference")).lower(), 0)
    if evidence.get("direct") is False:
        base -= 20
    if evidence.get("fresh") is False:
        base -= 30
    if evidence.get("resolved") is False:
        base -= 40
    return max(base, 0)


def evidence_can_verify(evidence: Mapping[str, Any], required_source_kind: str | None = None) -> bool:
    """Return True only for direct, fresh, resolved, non-self-authorizing evidence.

    Receipts, docs, chat and inference can support a claim but can never promote
    themselves (or another claim) to VERIFIED. A caller may require a specific
    source kind for scope-sensitive claims such as runtime verification.
    """
    source_kind = str(evidence.get("source_kind", "inference")).lower()
    if required_source_kind and source_kind != required_source_kind.lower():
        return False
    if source_kind not in VERIFY_CAPABLE_SOURCE_KINDS:
        return False
    if source_kind in NON_AUTHORITATIVE_SOURCE_KINDS:
        return False
    return (
        evidence.get("supports") is True
        and evidence.get("direct") is True
        and evidence.get("fresh", True) is True
        and evidence.get("resolved", True) is True
        and evidence.get("self_authorizing", False) is not True
        and evidence_strength(evidence) >= 60
    )


def classify_claim(
    evidence: Iterable[dict[str, Any]],
    blocked: bool = False,
    required_source_kind: str | None = None,
) -> tuple[str, list[str]]:
    items = list(evidence)
    notes: list[str] = []
    if blocked and not items:
        return "BLOCKED", ["required evidence source is unavailable"]
    if not items:
        return "UNKNOWN", ["no evidence supplied"]

    opposing = [e for e in items if e.get("supports") is False and evidence_strength(e) >= 60]
    supporting = [e for e in items if e.get("supports") is True]
    verifying = [e for e in supporting if evidence_can_verify(e, required_source_kind)]
    stale_only = supporting and all(e.get("fresh") is False for e in supporting)

    if opposing:
        notes.append("direct/authoritative evidence contradicts the claim")
        return "DISPROVEN", notes
    if verifying:
        strongest = max(verifying, key=evidence_strength)
        notes.append(f"verification-capable evidence via {strongest.get('source_kind', 'unknown')}")
        return "VERIFIED", notes
    if stale_only:
        return "STALE", ["support exists only for an earlier state"]
    if supporting:
        strongest = max(supporting, key=evidence_strength)
        kind = str(strongest.get("source_kind", "inference")).lower()
        if required_source_kind and kind != required_source_kind.lower():
            return "PARTIAL", [f"support exists, but {required_source_kind} evidence is required"]
        if kind in NON_AUTHORITATIVE_SOURCE_KINDS or strongest.get("self_authorizing") is True:
            return "PARTIAL", ["support exists, but the evidence source cannot self-authorize VERIFIED"]
        if strongest.get("resolved") is False:
            return "PARTIAL", ["support exists, but its evidence reference is unresolved"]
        if evidence_strength(strongest) >= 40:
            return "PARTIAL", ["support exists but is not direct enough for VERIFIED"]
        return "INFERRED", ["support is inferential"]
    return "UNKNOWN", ["evidence supplied but none supports the claim"]


def _required_text(value: Any, name: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{name} is required")
    return value.strip()


def _parse_timestamp(value: Any, name: str) -> datetime:
    text = _required_text(value, name)
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError(f"{name} must be an ISO-8601 timestamp") from exc
    if parsed.tzinfo is None:
        raise ValueError(f"{name} must include a timezone")
    return parsed


def assert_source_identity(value: Mapping[str, Any]) -> None:
    _required_text(value.get("canonical_remote"), "source.canonical_remote")
    _required_text(value.get("repository"), "source.repository")
    _required_text(value.get("branch"), "source.branch")
    commit_sha = _required_text(value.get("commit_sha"), "source.commit_sha")
    if not SHA_40.fullmatch(commit_sha):
        raise ValueError("source.commit_sha must be a full 40-character Git SHA")


def assert_dependency_identity(value: Mapping[str, Any]) -> None:
    _required_text(value.get("lockfile_path"), "dependency.lockfile_path")
    digest = _required_text(value.get("lockfile_sha256"), "dependency.lockfile_sha256")
    if not SHA_64.fullmatch(digest):
        raise ValueError("dependency.lockfile_sha256 must be a 64-character SHA-256 digest")
    package_manager = _required_text(value.get("package_manager"), "dependency.package_manager").lower()
    if package_manager not in VALID_PACKAGE_MANAGERS:
        raise ValueError(f"unsupported dependency.package_manager: {package_manager!r}")


def assert_runtime_identity(value: Mapping[str, Any]) -> None:
    environment = _required_text(value.get("environment"), "runtime.environment").lower()
    if environment not in VALID_RUNTIME_ENVS:
        raise ValueError(f"unsupported runtime.environment: {environment!r}")
    _required_text(value.get("build_id"), "runtime.build_id")
    deployment_url = value.get("deployment_url")
    if deployment_url is not None:
        parsed = urlparse(_required_text(deployment_url, "runtime.deployment_url"))
        if parsed.scheme.lower() != "https" or not parsed.netloc:
            raise ValueError("runtime.deployment_url must use HTTPS when present")


def assert_evidence_identity(value: Mapping[str, Any]) -> None:
    if not isinstance(value, Mapping):
        raise ValueError("identity must be an object")
    source = value.get("source")
    if not isinstance(source, Mapping):
        raise ValueError("identity.source is required")
    assert_source_identity(source)
    dependency = value.get("dependency")
    if dependency is not None:
        if not isinstance(dependency, Mapping):
            raise ValueError("identity.dependency must be an object")
        assert_dependency_identity(dependency)
    runtime = value.get("runtime")
    if runtime is not None:
        if not isinstance(runtime, Mapping):
            raise ValueError("identity.runtime must be an object")
        assert_runtime_identity(runtime)


def _assert_string_list(value: Any, name: str) -> list[str]:
    if not isinstance(value, (list, tuple)):
        raise ValueError(f"{name} must be an array")
    out: list[str] = []
    for item in value:
        if not isinstance(item, str) or not item.strip():
            raise ValueError(f"{name} entries must be non-empty strings")
        out.append(item.strip())
    if len(set(out)) != len(out):
        raise ValueError(f"{name} must not contain duplicates")
    return out


def _ref_scheme(ref: str) -> str:
    if "://" in ref:
        return ref.split("://", 1)[0].lower()
    if ":" in ref:
        return ref.split(":", 1)[0].lower()
    return ""


def evidence_ref_is_non_authoritative(ref: str) -> bool:
    return _ref_scheme(ref) in NON_AUTHORITATIVE_REF_SCHEMES


def assert_receipt_shape(value: Mapping[str, Any]) -> None:
    rid = _required_text(value.get("id"), "receipt.id")
    finding_id = _required_text(value.get("finding_id"), "receipt.finding_id")
    if not RECEIPT_ID.fullmatch(rid):
        raise ValueError("receipt.id must be an uppercase stable identifier")
    if not RECEIPT_ID.fullmatch(finding_id):
        raise ValueError("receipt.finding_id must be an uppercase stable identifier")
    _required_text(value.get("check"), "receipt.check")
    state = normalize_label(value.get("state"))
    _parse_timestamp(value.get("observed_at"), "receipt.observed_at")
    _required_text(value.get("summary"), "receipt.summary")
    identity = value.get("identity")
    if not isinstance(identity, Mapping):
        raise ValueError("receipt.identity is required")
    assert_evidence_identity(identity)

    evidence_refs = _assert_string_list(value.get("evidence_refs", []), "receipt.evidence_refs")
    invalidated_by = _assert_string_list(value.get("invalidated_by", []), "receipt.invalidated_by")
    markers = _assert_string_list(value.get("non_authoritative_markers", []), "receipt.non_authoritative_markers")
    unknown_markers = {marker.lower() for marker in markers} - NON_AUTHORITATIVE_MARKERS
    if unknown_markers:
        raise ValueError(f"unsupported non-authoritative markers: {sorted(unknown_markers)}")

    if state == "VERIFIED":
        if not evidence_refs:
            raise ValueError("verified receipts require at least one evidence reference")
        if all(evidence_ref_is_non_authoritative(ref) for ref in evidence_refs):
            raise ValueError("non-authoritative markers/receipts cannot be the sole basis of verification")
    if state == "STALE" and not invalidated_by:
        raise ValueError("stale receipts require one or more invalidation reasons")

    if value.get("authorizes") is True or value.get("merge_authority") is True or value.get("deploy_authority") is True:
        raise ValueError("receipts cannot grant execution/merge/deploy authority")


def _dict_equal(left: Mapping[str, Any] | None, right: Mapping[str, Any] | None, keys: Sequence[str]) -> bool:
    if left is None or right is None:
        return left is right
    return all(left.get(key) == right.get(key) for key in keys)


def same_source(left: Mapping[str, Any], right: Mapping[str, Any]) -> bool:
    return _dict_equal(left, right, ("canonical_remote", "repository", "branch", "commit_sha"))


def same_dependency(left: Mapping[str, Any] | None, right: Mapping[str, Any] | None) -> bool:
    return _dict_equal(left, right, ("lockfile_path", "lockfile_sha256", "package_manager"))


def same_runtime(left: Mapping[str, Any] | None, right: Mapping[str, Any] | None) -> bool:
    return _dict_equal(left, right, ("environment", "build_id", "deployment_url"))


def evaluate_staleness(receipt: Mapping[str, Any], current_identity: Mapping[str, Any]) -> dict[str, Any]:
    assert_receipt_shape(receipt)
    assert_evidence_identity(current_identity)
    invalidated_by: list[str] = []
    receipt_identity = receipt["identity"]

    if not same_source(receipt_identity["source"], current_identity["source"]):
        invalidated_by.append("source_identity_changed")
    if not same_dependency(receipt_identity.get("dependency"), current_identity.get("dependency")):
        invalidated_by.append("dependency_identity_changed")
    if not same_runtime(receipt_identity.get("runtime"), current_identity.get("runtime")):
        invalidated_by.append("runtime_identity_changed")

    if invalidated_by:
        return {"state": "STALE", "invalidated_by": invalidated_by}
    return {
        "state": normalize_label(receipt.get("state")),
        "invalidated_by": list(receipt.get("invalidated_by") or []),
    }


def invalidate_if_stale(
    receipt: Mapping[str, Any], current_identity: Mapping[str, Any], observed_at: str
) -> dict[str, Any]:
    _parse_timestamp(observed_at, "observed_at")
    result = evaluate_staleness(receipt, current_identity)
    if result["state"] != "STALE":
        return dict(receipt)
    updated = dict(receipt)
    updated["state"] = "STALE"
    updated["observed_at"] = observed_at
    updated["invalidated_by"] = result["invalidated_by"]
    return updated


def _effective_state(receipt: Mapping[str, Any], current_identity: Mapping[str, Any] | None) -> str:
    if current_identity is None:
        return normalize_label(receipt.get("state"))
    return str(evaluate_staleness(receipt, current_identity)["state"])


def can_candidate_proceed(
    receipts: Sequence[Mapping[str, Any]],
    required_checks: Sequence[str],
    current_identity: Mapping[str, Any] | None = None,
) -> bool:
    if not required_checks:
        return False
    if current_identity is not None:
        assert_evidence_identity(current_identity)
    by_check: dict[str, list[Mapping[str, Any]]] = {}
    for receipt in receipts:
        assert_receipt_shape(receipt)
        by_check.setdefault(str(receipt["check"]), []).append(receipt)
    return all(
        any(_effective_state(receipt, current_identity) == "VERIFIED" for receipt in by_check.get(check, []))
        for check in required_checks
    )


def is_merge_eligible(
    receipts: Sequence[Mapping[str, Any]],
    required_checks: Sequence[str],
    current_identity: Mapping[str, Any] | None = None,
) -> bool:
    """Evidence eligibility only; this function never grants merge authority."""
    if not can_candidate_proceed(receipts, required_checks, current_identity):
        return False
    blocking_states = {"BLOCKED", "UNKNOWN", "STALE", "DISPROVEN"}
    for receipt in receipts:
        state = _effective_state(receipt, current_identity)
        if current_identity is not None and state == "STALE":
            continue
        if state in blocking_states:
            return False
    return True


def diagnose_runtime_boundary(runtime: dict[str, Any] | None) -> dict[str, Any] | None:
    if not runtime:
        return None
    stages = list(runtime.get("stages") or [])
    last_idx = -1
    for idx, stage in enumerate(stages):
        if stage.get("received") is True and stage.get("evidence"):
            last_idx = idx
        else:
            break
    last = stages[last_idx]["name"] if last_idx >= 0 else "UNKNOWN"
    first_unproven = stages[last_idx + 1]["name"] if last_idx + 1 < len(stages) else "NONE"
    producer = runtime.get("producer") if runtime.get("producer_proven") is True else "UNKNOWN"
    return {
        "request": runtime.get("request", "UNKNOWN"),
        "response": runtime.get("response", "UNKNOWN"),
        "last_proven_received": last,
        "first_unproven_forward_transition": first_unproven,
        "who_produced_outcome": producer or "UNKNOWN",
        "attribution_rule": "message/status/provider wording alone never proves WHO",
    }
