#!/usr/bin/env python3
"""Validate an ordered Juss OS receipt chain and its local evidence.

Exit: 0 structurally OK + hashes and head matched; 1 STALE; 2 BROKEN;
      3 UNVERIFIED when authoritative or evidentiary checks are incomplete.

This checker verifies local file bytes and receipt structure. It does NOT prove
who authored receipts, that external providers observed an action, or that the
recorded proof is independently trustworthy.
"""
import argparse
import hashlib
import os
import pathlib
import re
import sys
from datetime import datetime, timezone

REQUIRED = ("RECEIPT-ID", "PREDECESSOR", "CREATED-AT", "AUTHORITY-DIGEST")
FIELD = re.compile(r"^([A-Z][A-Z0-9-]*(?: / [A-Z][A-Z0-9-]*)*):\s*(.*)$")
NONE = {"", "none", "n/a", "-"}
FULL_SHA = re.compile(r"^[0-9a-fA-F]{40}(?:[0-9a-fA-F]{24})?$")
SHA_IN_AUTHORITY = re.compile(r"@([0-9a-fA-F]{7,64})(?![0-9a-fA-F])")
DIGEST_RE = re.compile(r"^sha256:[a-f0-9]{64}$")


def evidence_path(root, name):
    """Reject traversal/absolute paths and symlink escapes from evidence root."""
    if not isinstance(name, str) or not name or '\\' in name or '\0' in name:
        raise ValueError("unsafe evidence path")
    p = pathlib.PurePosixPath(name)
    if p.is_absolute() or any(part in ("..", ".") for part in name.split('/')):
        raise ValueError("evidence path must be relative, without traversal")
    base = pathlib.Path(root).resolve(strict=True)
    target = (base / p).resolve(strict=True)
    if not target.is_relative_to(base) or not target.is_file():
        raise ValueError("evidence path escapes root or is not a regular file")
    return target


def digest(root, paths):
    """SHA-256 of path + NUL + file contents + NUL, in the given order."""
    h = hashlib.sha256()
    for name in paths:
        target = evidence_path(root, name)
        h.update(name.encode('utf-8') + b'\0')
        with target.open('rb') as f:
            for chunk in iter(lambda: f.read(65536), b''):
                h.update(chunk)
        h.update(b'\0')
    return "sha256:" + h.hexdigest()


def parse(path):
    fields = {}
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip().strip("`")
            m = FIELD.match(line)
            if m:
                key = m.group(1)
                if key in fields:
                    raise ValueError(f"duplicate receipt field {key}")
                fields[key] = m.group(2).strip()
    return fields


def parse_time(value):
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (TypeError, ValueError, AttributeError):
        return None
    return dt if dt.tzinfo is not None and dt.utcoffset() is not None else None


def check(rdir, head=None, eroot=None, now=None):
    now = now if now is not None else datetime.now(timezone.utc)
    broken, stale, notes = [], [], []
    if not FULL_SHA.fullmatch(head or ""):
        if head is None:
            notes.append("--head missing: cannot verify exact source revision")
        else:
            broken.append("--head must be a full 40- or 64-hex commit ID")
    if eroot is None:
        notes.append("--evidence-root missing: evidence hashes cannot be checked")
    if not isinstance(now, datetime) or now.tzinfo is None or now.utcoffset() is None:
        broken.append("--now must have an explicit timezone")
    receipts = {}
    try:
        names = sorted(os.listdir(rdir))
    except OSError as e:
        return 2, [f"BROKEN: receipts directory unreadable: {e}"], notes
    for name in names:
        if not name.endswith(".md"):
            continue
        path = os.path.join(rdir, name)
        if not os.path.isfile(path) or os.path.islink(path):
            broken.append(f"{name}: receipt must be a regular file, not a symlink")
            continue
        try:
            fields = parse(path)
        except (OSError, UnicodeError, ValueError) as e:
            broken.append(f"{name}: receipt invalid/unreadable: {e}")
            continue
        if "RECEIPT-ID" not in fields:
            broken.append(f"{name}: missing RECEIPT-ID")
            continue
        missing = [key for key in REQUIRED if not fields.get(key)]
        if missing:
            broken.append(f"{name}: missing {', '.join(missing)}")
        rid = fields["RECEIPT-ID"]
        if rid in receipts:
            broken.append(f"{name}: duplicate RECEIPT-ID {rid}")
            continue
        receipts[rid] = (name, fields)

    if not receipts:
        return 2, ["BROKEN: no receipts found"] + [f"  ✗ {b}" for b in broken], notes

    pred = {rid: fields.get("PREDECESSOR", "").strip() for rid, (_, fields) in receipts.items()}
    roots = [rid for rid, parent in pred.items() if parent.lower() in NONE]
    children = {}
    for rid, parent in pred.items():
        if parent.lower() in NONE:
            continue
        if parent not in receipts:
            broken.append(f"{rid}: PREDECESSOR {parent} not found")
        children.setdefault(parent, []).append(rid)
    if len(roots) != 1:
        broken.append(f"chain must have exactly one root, found {len(roots)}: {roots}")
    for parent, kids in children.items():
        if len(kids) > 1:
            broken.append(f"fork: {parent} has successors {sorted(kids)}")

    for rid, (_, fields) in receipts.items():
        successor = fields.get("SUCCESSOR", "").strip()
        kids = children.get(rid, [])
        if len(kids) == 1 and successor != kids[0]:
            broken.append(f"{rid}: missing/wrong SUCCESSOR back-link to {kids[0]}")
        if successor.lower() in NONE or successor.startswith("<"):
            continue
        if successor not in receipts or pred.get(successor) != rid:
            broken.append(f"{rid}: SUCCESSOR {successor} does not point back")

    order = []
    if len(roots) == 1:
        current, seen = roots[0], set()
        while current:
            if current in seen:
                broken.append(f"cycle at {current}")
                break
            seen.add(current)
            order.append(current)
            kids = children.get(current, [])
            current = kids[0] if len(kids) == 1 else None
        orphans = set(receipts) - seen
        if orphans:
            broken.append(f"unreachable from root: {sorted(orphans)}")

    tip = order[-1] if order else None
    for rid, (name, fields) in receipts.items():
        ed = fields.get("EVIDENCE-DIGEST", "")
        if not ed or ed.startswith("<") or "sha256 of" in ed:
            notes.append(f"{rid}: EVIDENCE-DIGEST placeholder or missing")
        elif not DIGEST_RE.fullmatch(ed):
            broken.append(f"{rid}: invalid EVIDENCE-DIGEST encoding")
        elif eroot is not None:
            paths = [p.strip() for p in fields.get("EVIDENCE", "").split(",") if p.strip()]
            if not paths:
                broken.append(f"{rid}: EVIDENCE-DIGEST set but no EVIDENCE paths listed")
            else:
                try:
                    actual = digest(eroot, paths)
                    if actual != ed:
                        broken.append(f"{rid}: EVIDENCE-DIGEST mismatch")
                except (OSError, ValueError) as e:
                    broken.append(f"{rid}: evidence invalid/unreadable: {e}")

        created = fields.get("CREATED-AT", "")
        created_at = parse_time(created)
        if not created_at:
            broken.append(f"{rid}: CREATED-AT must be timezone-aware ISO-8601")
        elif isinstance(now, datetime) and now.tzinfo is not None and now.utcoffset() is not None and created_at > now:
            broken.append(f"{rid}: CREATED-AT is in the future relative to the verification time")
        recheck = fields.get("RECHECK-BY", "").strip()
        if recheck:
            dt = parse_time(recheck)
            if dt is None:
                notes.append(f"{rid}: RECHECK-BY event/invalid date not independently evaluated")
            elif rid == tip and dt < now:
                stale.append(f"{rid}: RECHECK-BY {recheck} has passed")

    if tip and head and FULL_SHA.fullmatch(head):
        rec = receipts[tip][1].get("AUTHORITY-DIGEST", "")
        matches = SHA_IN_AUTHORITY.findall(rec)
        if not matches:
            broken.append(f"{tip}: AUTHORITY-DIGEST has no @<sha>")
        elif len(matches) != 1:
            broken.append(f"{tip}: AUTHORITY-DIGEST must contain exactly one repository SHA reference")
        elif len(matches[0]) != len(head):
            notes.append(f"{tip}: AUTHORITY-DIGEST uses abbreviated/nonmatching-width SHA; exact head unverified")
        elif matches[0].lower() != head.lower():
            stale.append(f"{tip}: AUTHORITY-DIGEST does not match provided HEAD")

    chain = ["CHAIN: " + " -> ".join(order)] if order else []
    if broken:
        return 2, ["BROKEN"] + chain + [f"  ✗ {item}" for item in broken], notes
    if stale:
        return 1, ["STALE"] + chain + [f"  ! {item}" for item in stale], notes
    if notes:
        return 3, ["UNVERIFIED"] + chain + [f"TIP: {tip}"], notes
    return 0, ["OK"] + chain + [f"TIP: {tip}"], notes


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("target", nargs="?")
    ap.add_argument("paths", nargs="*")
    ap.add_argument("--head")
    ap.add_argument("--evidence-root")
    ap.add_argument("--now")
    ap.add_argument("--digest", action="store_true", help="print digest for evidence-root and relative paths")
    args = ap.parse_args(argv)
    if args.digest:
        if not args.target or not args.paths:
            ap.error("--digest needs <evidence-root> <path> [...]")
        try:
            print(digest(args.target, args.paths))
        except (OSError, ValueError) as e:
            ap.error(f"unsafe or unreadable evidence: {e}")
        return 0
    if not args.target:
        ap.error("receipts dir required")
    if args.now and parse_time(args.now) is None:
        ap.error("--now must be ISO-8601 with explicit timezone")
    code, lines, notes = check(args.target, args.head, args.evidence_root, parse_time(args.now) if args.now else None)
    print("\n".join(lines))
    for note in notes:
        print(f"  ~ {note}")
    return code


if __name__ == "__main__":
    sys.exit(main())
