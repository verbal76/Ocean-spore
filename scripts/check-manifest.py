#!/usr/bin/env python3
"""Release-qualification gate for the BUILT APK (reads the merged manifest).

usage: check-manifest.py app.apk [--expect-version N]

Fails on: wrong package, wrong versionCode/versionName, targetSdk != 36,
minSdk != 24, any permission outside the allowlist, any foreground-service /
microphone service, non-portrait orientation, debuggable build, or a signing
certificate other than the historical debug certificate (kept on purpose for
upgrade compatibility with build-39; see docs/RELEASING.md "Signing").
"""
import glob, os, re, subprocess, sys

PACKAGE = "com.verbal76.oceanspore"
TARGET_SDK, MIN_SDK = 36, 24
ALLOWED_PERMISSIONS = {
    "android.permission.INTERNET",
    "android.permission.ACCESS_NETWORK_STATE",
    "android.permission.VIBRATE",
    f"{PACKAGE}.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION",   # added by AndroidX for receivers
}
# Historical Android debug certificate (build-39 and v40). Do NOT rotate casually.
EXPECTED_CERT_SHA256 = "fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c"


def run(*args):
    r = subprocess.run(args, capture_output=True, text=True)
    return r.stdout + r.stderr


def tool(name):
    hits = sorted(glob.glob(os.path.join(os.environ.get("ANDROID_HOME", ""), "build-tools", "*", name)))
    return hits[-1] if hits else name


def expected_version():
    out = subprocess.run(["node", os.path.join(os.path.dirname(__file__), "version.js"), "version-code"],
                         capture_output=True, text=True).stdout.strip()
    return int(out)


def main():
    if len(sys.argv) < 2:
        print(__doc__); return 2
    apk = sys.argv[1]
    want = int(sys.argv[sys.argv.index("--expect-version") + 1]) if "--expect-version" in sys.argv else expected_version()
    aapt2 = tool("aapt2")
    badging = run(aapt2, "dump", "badging", apk)
    xml = run(aapt2, "dump", "xmltree", "--file", "AndroidManifest.xml", apk)
    fails = []

    def g(pat):
        m = re.search(pat, badging)
        return m.group(1) if m else None

    pkg = g(r"package: name='([^']+)'")
    vcode = g(r"versionCode='(\d+)'")
    vname = g(r"versionName='([^']*)'")
    tsdk = g(r"targetSdkVersion:'(\d+)'")
    msdk = g(r"sdkVersion:'(\d+)'")

    if pkg != PACKAGE:
        fails.append(f"package is {pkg}, expected {PACKAGE}")
    if vcode != str(want):
        fails.append(f"versionCode {vcode} != {want}")
    if vname != str(want):
        fails.append(f"versionName {vname} != {want}")
    if tsdk != str(TARGET_SDK):
        fails.append(f"targetSdk {tsdk} != {TARGET_SDK}")
    if msdk != str(MIN_SDK):
        fails.append(f"minSdk {msdk} != {MIN_SDK}")

    perms = set(re.findall(r"uses-permission: name='([^']+)'", badging))
    extra = sorted(perms - ALLOWED_PERMISSIONS)
    if extra:
        fails.append(f"unexpected permissions in merged manifest: {extra}")

    if "foregroundServiceType" in xml:
        fails.append("a foreground-service type is declared (game plays short effects only)")
    for svc in re.findall(r'E: service[\s\S]*?android:name\(0x[0-9a-f]+\)="([^"]+)"', xml):
        if "Recording" in svc or "AudioControls" in svc:
            fails.append(f"audio service still declared: {svc}")

    if not re.search(r"screenOrientation\(0x[0-9a-f]+\)=1\b", xml):
        fails.append("activity is not portrait (screenOrientation != 1)")
    if re.search(r"debuggable\(0x[0-9a-f]+\)=(true|\(type 0x12\)0xffffffff)", xml):
        fails.append("APK is debuggable")

    certs = run(tool("apksigner"), "verify", "--print-certs", apk)
    m = re.search(r"certificate SHA-256 digest: ([0-9a-f]{64})", certs)
    if not m:
        print("WARN: apksigner unavailable, signing certificate not checked")
    elif m.group(1) != EXPECTED_CERT_SHA256:
        fails.append(f"signing certificate {m.group(1)[:16]}... != historical debug cert (upgrade over build-39 would break)")

    short = sorted(p.split(".")[-1] for p in perms)
    print(f"{os.path.basename(apk)}: package={pkg} versionCode={vcode} target={tsdk} min={msdk} perms={short}")
    if fails:
        print("MANIFEST CHECK FAILED"); [print(" -", f) for f in fails]
        return 1
    print("manifest check OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
