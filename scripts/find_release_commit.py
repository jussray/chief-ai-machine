#!/usr/bin/env python3
"""Read-only local commit reconciliation audit.

Resolves a specific commit SHA or prefix and verifies its ancestry in the
approved history, without modifying branches, credentials, or configuration.
"""

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path


class AuditError(Exception):
    pass


def git(repo, *args, allowed=(0,)):
    """Execute a git command in a repository."""
    result = subprocess.run(
        ["git", "-C", str(repo), *args],
        text=True,
        capture_output=True,
        check=False,
        timeout=120,
    )
    if result.returncode not in allowed:
        detail = result.stderr.strip() or result.stdout.strip()
        raise AuditError(
            f"git {' '.join(args)} failed: {detail}"
        )
    return result


def resolve_commit(repo, prefix):
    """Resolve a commit SHA or prefix to an exact commit."""
    if not re.fullmatch(r"[0-9a-fA-F]{7,40}", prefix):
        raise AuditError("Use a 7–40 character hexadecimal commit ID.")

    prefix = prefix.lower()

    objects = git(
        repo,
        "rev-parse",
        f"--disambiguate={prefix}",
    ).stdout.splitlines()

    commits = []
    for oid in objects:
        kind = git(repo, "cat-file", "-t", oid).stdout.strip()
        if kind == "commit":
            commits.append(oid)

    commits = sorted(set(commits))

    if not commits:
        raise AuditError(
            "No matching commit in this clone. "
            "Fetch approved refs and retry; do not substitute HEAD."
        )

    if len(commits) != 1:
        raise AuditError(
            "Ambiguous commit prefix: " + ", ".join(commits)
        )

    return commits[0]


def is_ancestor(repo, ancestor, descendant):
    """Check if ancestor is an ancestor of descendant."""
    result = git(
        repo,
        "merge-base",
        "--is-ancestor",
        ancestor,
        descendant,
        allowed=(0, 1),
    )
    return result.returncode == 0


def main():
    parser = argparse.ArgumentParser(
        description="Read-only local commit reconciliation audit."
    )
    parser.add_argument("--repo", required=True, type=Path)
    parser.add_argument("--commit", required=True)
    parser.add_argument("--approved-ref", default="origin/main")
    parser.add_argument(
        "--requires",
        action="append",
        default=[],
        help="Required ancestor SHA/prefix; may be repeated.",
    )
    args = parser.parse_args()

    repo = args.repo.resolve()

    if args.approved_ref.startswith("-"):
        raise AuditError("Approved ref must not start with '-'.")

    git(repo, "rev-parse", "--git-dir")

    shallow = git(
        repo, "rev-parse", "--is-shallow-repository"
    ).stdout.strip()

    if shallow != "false":
        raise AuditError(
            "Shallow history is not accepted for ancestry auditing."
        )

    candidate = resolve_commit(repo, args.commit)

    approved = git(
        repo,
        "rev-parse",
        "--verify",
        "--end-of-options",
        f"{args.approved_ref}^{{commit}}",
    ).stdout.strip()

    required = [
        resolve_commit(repo, value)
        for value in args.requires
    ]

    required_results = [
        {
            "commit": commit,
            "included": is_ancestor(repo, commit, candidate),
        }
        for commit in required
    ]

    on_approved_history = is_ancestor(
        repo, candidate, approved
    )

    metadata = git(
        repo,
        "show",
        "-s",
        "--format=%s",
        candidate,
    ).stdout.strip()

    passed = (
        on_approved_history
        and all(item["included"] for item in required_results)
    )

    report = {
        "candidate": candidate,
        "subject": metadata,
        "approvedRef": args.approved_ref,
        "approvedHeadSnapshot": approved,
        "candidateOnApprovedHistory": on_approved_history,
        "requiredAncestors": required_results,
        "historyAuditPassed": passed,
        "compatibilityTested": False,
    }

    print(json.dumps(report, indent=2))
    return 0 if passed else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (
        AuditError,
        OSError,
        subprocess.TimeoutExpired,
    ) as error:
        print(
            json.dumps({"error": str(error)}, indent=2),
            file=sys.stderr,
        )
        sys.exit(2)
