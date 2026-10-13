#!/usr/bin/env python3
"""A build number may identify only one release. Fails if tag v<version> already
exists, so a publish can never silently replace a released APK with different
source (build-number reuse / silent artifact replacement). Bump
package.json oceanSpore.build for every new candidate.

Usage: check-version-unused.py <versionName> [--repo DIR]
"""
import os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    if len(sys.argv) < 2:
        print(__doc__); return 2
    version = sys.argv[1]
    repo = sys.argv[sys.argv.index("--repo") + 1] if "--repo" in sys.argv else ROOT
    # build-N is the standard tag; v<N> was used by the first two resurrection releases.
    for tag in (f"build-{version}", f"v{version}"):
        r = subprocess.run(["git", "-C", repo, "tag", "-l", tag], capture_output=True, text=True)
        if r.returncode != 0:
            print("git tag lookup failed:", r.stderr.strip()); return 1
        if r.stdout.strip():
            sha = subprocess.run(["git", "-C", repo, "rev-parse", "--short", tag + "^{commit}"], capture_output=True, text=True).stdout.strip()
            print(f"BUILD NUMBER ALREADY RELEASED: tag {tag} exists (-> {sha}). Bump oceanSpore.build in package.json; a release is immutable.")
            return 1
    print(f"build number {version} is unused")
    return 0


if __name__ == "__main__":
    sys.exit(main())
