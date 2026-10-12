#!/usr/bin/env python3
"""Release-critical source authorization (docs/ARCHITECTURE.md, docs/source-line.json).

Answers one question: is THIS checkout exactly the approved commit, and does that
commit belong to the authorized development history? It never looks at unrelated
branches (that is scripts/audit-branches.py, which only reports).

Modes
  (default)             development check: build ref not forbidden; HEAD sits on the line
                        (contains, or is contained in, an authorized origin branch).
  --release             requires --approved-sha (or env APPROVED_SHA): a FULL 40-hex SHA.
                        Fails unless HEAD == approved SHA, approved SHA is the tip of or an
                        ancestor of an authorized line branch, the clone is not shallow, and
                        the build ref is not forbidden. A branch name is never accepted and
                        a branch tip is never substituted for the approved SHA.
  --verify-manifest F   (needs --approved-sha) release-manifest.json names the same SHA.
                        Needs no git history.

Options: --repo DIR, --config FILE (tests).
"""
import json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sourceline_common import ROOT, Repo, arg, load_config  # noqa: E402

FULL_SHA = re.compile(r"^[0-9a-f]{40}$")


def build_ref():
    return (os.environ.get("BUILD_REF") or os.environ.get("GITHUB_HEAD_REF")
            or os.environ.get("GITHUB_REF_NAME") or "").replace("refs/heads/", "")


def verify_manifest(path, approved):
    fails = []
    if not approved or not FULL_SHA.match(approved):
        return ["--verify-manifest needs a full 40-hex --approved-sha"]
    try:
        m = json.load(open(path))
    except Exception as e:  # unreadable / malformed manifest is a failure, not a skip
        return [f"cannot read manifest {path}: {e}"]
    if m.get("sourceCommit") != approved:
        fails.append(f"manifest sourceCommit {str(m.get('sourceCommit'))[:7]} != approved {approved[:7]}")
    if m.get("approvedSha") not in (None, approved):
        fails.append(f"manifest approvedSha {str(m.get('approvedSha'))[:7]} != approved {approved[:7]}")
    arts = m.get("artifacts") or []
    if not arts or not all(a.get("sha256") and a.get("platform") for a in arts):
        fails.append("manifest lists no complete artifact entries")
    return fails


def main():
    cfg = load_config(arg("--config"))
    approved = arg("--approved-sha", os.environ.get("APPROVED_SHA"))

    if "--verify-manifest" in sys.argv:
        fails = verify_manifest(arg("--verify-manifest"), approved)
        label = "manifest matches approved source"
    else:
        repo = Repo(arg("--repo", ROOT))
        release = "--release" in sys.argv
        fails = []

        ref = build_ref()
        for f in cfg["forbiddenBuildRefs"]:
            if ref == f["ref"]:
                fails.append(f"build ref '{ref}' is forbidden: {f['why']}")

        head = repo.out("rev-parse", "HEAD")
        line = [(b, f"origin/{b}") for b in cfg["authoritativeLine"]["branches"]]
        tips = repo.remote_tips()
        present = [(b, r) for b, r in line if r in tips]
        if not present:
            fails.append("none of the authorized line branches exist as origin/<branch>: " +
                         ", ".join(b for b, _ in line))

        if release:
            if not approved or not FULL_SHA.match(approved):
                fails.append("release builds need an explicit full 40-hex approved SHA (a branch name or short SHA is not accepted)")
            else:
                if head != approved:
                    fails.append(f"checkout HEAD {head[:7]} != approved SHA {approved[:7]}")
                if repo.is_shallow():
                    fails.append("shallow checkout: lineage cannot be verified (use fetch-depth: 0)")
                elif not repo.has_commit(approved):
                    fails.append(f"approved SHA {approved[:7]} is not in this repository")
                elif present and not any(repo.is_ancestor(approved, tips[r]) for _, r in present):
                    fails.append(f"approved SHA {approved[:7]} is not on the authorized development line ({', '.join(b for b, _ in line)})")
            label = f"release source OK: {head[:7]} == approved SHA, on the authorized line"
        else:
            if present and not any(repo.is_ancestor(tips[r], head) or repo.is_ancestor(head, tips[r]) for _, r in present):
                fails.append(f"HEAD {head[:7]} is neither on nor built on the authorized line")
            label = f"source line OK: {head[:7]} is on the authorized line"

    if fails:
        print("SOURCE CHECK FAILED")
        for f in fails:
            print(" -", f)
        return 1
    print(label)
    return 0


if __name__ == "__main__":
    sys.exit(main())
