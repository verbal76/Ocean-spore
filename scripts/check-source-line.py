#!/usr/bin/env python3
"""Single-source-of-truth guard (docs/ARCHITECTURE.md, docs/source-line.json).

Fails (never silently skips) when:
  * the checkout is shallow, so ancestry cannot be proven;
  * the commit being built is not a descendant of every recorded baseline;
  * the build ref is a forbidden legacy ref (BUILD_REF / GITHUB_HEAD_REF / GITHUB_REF_NAME);
  * a remote branch holds commits not reachable from the commit being built and
    is not accounted for in the ledger (so unmerged work cannot go unnoticed).

Usage: check-source-line.py [--commit SHA]    (default: HEAD)
"""
import json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CFG = os.path.join(ROOT, "docs", "source-line.json")


def git(*args, check=True):
    r = subprocess.run(["git", "-C", ROOT, *args], capture_output=True, text=True)
    if check and r.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)}: {r.stderr.strip()}")
    return r


def main():
    commit = "HEAD"
    if "--commit" in sys.argv:
        commit = sys.argv[sys.argv.index("--commit") + 1]
    cfg = json.load(open(CFG))
    fails = []

    build_ref = (os.environ.get("BUILD_REF") or os.environ.get("GITHUB_HEAD_REF")
                 or os.environ.get("GITHUB_REF_NAME") or "").replace("refs/heads/", "")
    for f in cfg["forbiddenBuildRefs"]:
        if build_ref == f["ref"]:
            fails.append(f"build ref '{build_ref}' is forbidden: {f['why']}")

    if git("rev-parse", "--is-shallow-repository").stdout.strip() == "true":
        fails.append("shallow checkout: ancestry cannot be verified (use fetch-depth: 0)")
    else:
        sha = git("rev-parse", commit).stdout.strip()
        for b in cfg["baselines"]:
            if git("cat-file", "-e", b["sha"] + "^{commit}", check=False).returncode != 0:
                fails.append(f"baseline missing from history: {b['name']} {b['sha'][:7]}")
            elif git("merge-base", "--is-ancestor", b["sha"], sha, check=False).returncode != 0:
                fails.append(f"{sha[:7]} is not a descendant of baseline: {b['name']} {b['sha'][:7]}")

        accounted = {l["ref"]: l["tip"] for l in cfg["ledger"]}
        refs = git("for-each-ref", "--format=%(refname:short) %(objectname)", "refs/remotes/origin").stdout.split("\n")
        for line in filter(None, refs):
            name, tip = line.split()
            if name.endswith("/HEAD"):
                continue
            n = int(git("rev-list", "--count", f"{sha}..{tip}").stdout.strip())
            if n == 0:
                continue
            if accounted.get(name) == tip:
                continue
            if name in accounted:
                fails.append(f"{name} moved to {tip[:7]} since it was ledgered ({accounted[name][:7]}); re-audit and update docs/source-line.json")
            else:
                fails.append(f"{name} has {n} commit(s) not in {sha[:7]} and is not in the ledger")

    if fails:
        print("SOURCE LINE CHECK FAILED")
        for f in fails:
            print(" -", f)
        return 1
    print(f"source line OK: {git('rev-parse', '--short', commit).stdout.strip()} descends from {len(cfg['baselines'])} baselines; all branches accounted for")
    return 0


if __name__ == "__main__":
    sys.exit(main())
