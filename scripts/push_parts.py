#!/usr/bin/env python3
"""
push_parts.py
Splits a file into N parts and pushes each to a GitHub repo via the
Contents API. Generalized from the one-off script used for jussray/promptos —
owner/repo/branch/file are all parameters, nothing is hardcoded, so this
works against any repo (including this one).

Requires: pip install requests

Usage:
    python3 scripts/push_parts.py --owner jussray --repo promptos --file index.html
    GITHUB_TOKEN=ghp_xxx python3 scripts/push_parts.py --owner jussray --repo chief-ai-machine --file some-large-file.txt

Prefer the GITHUB_TOKEN env var over --token — a token passed as a CLI
flag lands in shell history and process listings. --token is supported
only as a fallback.
"""

import argparse
import base64
import json
import os
import sys
import time
from pathlib import Path

try:
    import requests
except ImportError:
    sys.exit("Missing dependency — run: pip install requests")

API = "https://api.github.com"


def headers(token):
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def get_sha(token, owner, repo, branch, path):
    """Return current blob SHA for a file, or None if it doesn't exist."""
    r = requests.get(
        f"{API}/repos/{owner}/{repo}/contents/{path}",
        headers=headers(token),
        params={"ref": branch},
    )
    if r.status_code == 200:
        return r.json()["sha"]
    return None


def push_file(token, owner, repo, branch, path, content_str, message):
    encoded = base64.b64encode(content_str.encode("utf-8")).decode("ascii")
    sha = get_sha(token, owner, repo, branch, path)
    body = {"message": message, "content": encoded, "branch": branch}
    if sha:
        body["sha"] = sha
    r = requests.put(
        f"{API}/repos/{owner}/{repo}/contents/{path}",
        headers=headers(token),
        data=json.dumps(body),
    )
    if r.status_code in (200, 201):
        commit = r.json()["commit"]["sha"][:8]
        print(f"  ✓  {path}  →  commit {commit}")
    else:
        print(f"  ✗  {path}  →  {r.status_code}: {r.text[:200]}")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--owner", required=True)
    parser.add_argument("--repo", required=True)
    parser.add_argument("--branch", default="main")
    parser.add_argument("--file", default="index.html", help="Source file to split")
    parser.add_argument("--parts", type=int, default=12)
    parser.add_argument("--prefix", default="parts/p", help="Path prefix per part")
    parser.add_argument("--pad", type=int, default=2, help="Zero-pad width for part numbers")
    parser.add_argument("--ext", default=".txt", help="File extension per part")
    parser.add_argument("--token", help="GitHub PAT (prefer GITHUB_TOKEN env var instead)")
    args = parser.parse_args()

    token = os.environ.get("GITHUB_TOKEN") or args.token
    if not token:
        sys.exit("Missing token — set GITHUB_TOKEN or pass --token")
    if args.parts < 1:
        sys.exit(f"--parts must be a positive integer, got {args.parts}")

    src = Path(args.file)
    if not src.exists():
        sys.exit(f"File not found: {src}")

    content = src.read_text(encoding="utf-8")
    total = len(content)
    chunk = -(-total // args.parts)  # ceil division

    print(f"Source: {src}  ({total:,} chars)")
    print(f"Splitting into {args.parts} parts of ~{chunk:,} chars each\n")

    for i in range(args.parts):
        piece = content[i * chunk: (i + 1) * chunk]
        part_no = str(i + 1).zfill(args.pad)
        path = f"{args.prefix}{part_no}{args.ext}"
        frm, to = i * chunk, min((i + 1) * chunk, total)
        msg = f"feat: {path} (chars {frm:,}–{to:,})"
        push_file(token, args.owner, args.repo, args.branch, path, piece, msg)
        time.sleep(0.4)  # stay comfortably under GitHub's rate limit

    print(f"\n✅  All {args.parts} parts pushed.")
    print(f"If an assemble workflow watches {args.prefix}*{args.ext}, it will pick these up automatically.")
    print(f"Watch it at: https://github.com/{args.owner}/{args.repo}/actions")


if __name__ == "__main__":
    main()
