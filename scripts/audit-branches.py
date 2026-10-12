#!/usr/bin/env python3
"""Branch inventory / recovery audit. REPORTS; never gates a release.

Lists every origin branch and whether its commits are contained in the authorized
line, accounted for in the ledger (docs/source-line.json) at the recorded tip, moved
since it was ledgered, or unaccounted. Also checks the permanent historical baselines
are still reachable (audit evidence only).

Exit code is 0 unless --strict. Under GitHub Actions findings are emitted as
::warning:: annotations. Options: --repo DIR, --config FILE, --strict.
"""
import os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sourceline_common import ROOT, Repo, arg, load_config  # noqa: E402


def audit(repo, cfg):
    findings = []   # (severity, text)
    if repo.is_shallow():
        return [("warn", "shallow checkout: branch audit is incomplete (fetch full history)")], []
    tips = repo.remote_tips()
    line_refs = [f"origin/{b}" for b in cfg["authoritativeLine"]["branches"] if f"origin/{b}" in tips]
    ledger = {l["ref"]: l["tip"] for l in cfg["ledger"]}
    rows = []
    for name, tip in sorted(tips.items()):
        unique = min((int(repo.out("rev-list", "--count", f"{tips[r]}..{tip}")) for r in line_refs), default=-1)
        if unique == 0:
            rows.append((name, tip, "contained in the line", 0)); continue
        if name in line_refs:
            rows.append((name, tip, "authorized line", 0)); continue
        if ledger.get(name) == tip:
            rows.append((name, tip, "ledgered", unique)); continue
        if name in ledger:
            findings.append(("warn", f"{name} moved {ledger[name][:7]} -> {tip[:7]} since it was ledgered; re-audit"))
            rows.append((name, tip, "MOVED", unique))
        else:
            findings.append(("warn", f"{name} has {unique} commit(s) outside the line and is not in the ledger"))
            rows.append((name, tip, "UNACCOUNTED", unique))
    for b in cfg.get("historicalBaselines", []):
        if not repo.has_commit(b["sha"]):
            findings.append(("warn", f"historical baseline missing from history: {b['name']} {b['sha'][:7]}"))
        elif line_refs and not any(repo.is_ancestor(b["sha"], tips[r]) for r in line_refs):
            findings.append(("warn", f"historical baseline not reachable from the line (informational): {b['name']} {b['sha'][:7]}"))
    return findings, rows


def main():
    repo = Repo(arg("--repo", ROOT))
    findings, rows = audit(repo, load_config(arg("--config")))
    gha = os.environ.get("GITHUB_ACTIONS") == "true"
    for name, tip, status, unique in rows:
        print(f"  {name:<46} {tip[:7]}  {status}" + (f" ({unique} unique)" if unique > 0 else ""))
    for _, text in findings:
        print(f"::warning::{text}" if gha else f"WARNING: {text}")
    print(f"branch audit: {len(findings)} finding(s) (reporting only{'; --strict' if '--strict' in sys.argv else ''})")
    return 1 if findings and "--strict" in sys.argv else 0


if __name__ == "__main__":
    sys.exit(main())
