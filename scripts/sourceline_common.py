"""Shared helpers for check-source-line.py and audit-branches.py (no policy here)."""
import json, os, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_CONFIG = os.path.join(ROOT, "docs", "source-line.json")


def arg(name, default=None):
    import sys
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default


class Repo:
    def __init__(self, path):
        self.path = path

    def git(self, *args, check=True):
        r = subprocess.run(["git", "-C", self.path, *args], capture_output=True, text=True)
        if check and r.returncode != 0:
            raise RuntimeError(f"git {' '.join(args)}: {r.stderr.strip()}")
        return r

    def out(self, *args):
        return self.git(*args).stdout.strip()

    def is_shallow(self):
        return self.out("rev-parse", "--is-shallow-repository") == "true"

    def has_commit(self, sha):
        return self.git("cat-file", "-e", sha + "^{commit}", check=False).returncode == 0

    def is_ancestor(self, a, b):
        return self.git("merge-base", "--is-ancestor", a, b, check=False).returncode == 0

    def remote_tips(self):
        """{ 'origin/branch': sha } for every remote-tracking branch except HEAD."""
        tips = {}
        for line in filter(None, self.out("for-each-ref", "--format=%(refname:short) %(objectname)", "refs/remotes/origin").split("\n")):
            name, sha = line.split()
            if not name.endswith("/HEAD") and name != "origin":
                tips[name] = sha
        return tips


def load_config(path=None):
    return json.load(open(path or DEFAULT_CONFIG))
