#!/usr/bin/env python3
"""16 KB page-size qualification for an APK (Google Play, Android 15+).

Checks every native library for (1) ELF LOAD segments aligned to >= 16 KB and
(2) uncompressed .so entries whose data starts on a 16 KB zip boundary.
Exit code is non-zero if any 64-bit ABI (arm64-v8a, x86_64) library fails; the
32-bit ABIs are reported but informational, as Play only requires 64-bit.

usage: check-16kb.py app.apk [--json report.json]
"""
import json, struct, sys, zipfile

PAGE = 16384
REQUIRED_ABIS = {"arm64-v8a", "x86_64"}


def elf_min_load_align(data):
    if data[:4] != b"\x7fELF":
        return None
    is64 = data[4] == 2
    le = "<" if data[5] == 1 else ">"
    if is64:
        phoff, = struct.unpack_from(le + "Q", data, 0x20)
        phentsize, phnum = struct.unpack_from(le + "HH", data, 0x36)
    else:
        phoff, = struct.unpack_from(le + "I", data, 0x1C)
        phentsize, phnum = struct.unpack_from(le + "HH", data, 0x2A)
    aligns = []
    for i in range(phnum):
        off = phoff + i * phentsize
        p_type, = struct.unpack_from(le + "I", data, off)
        if p_type != 1:  # PT_LOAD
            continue
        align, = struct.unpack_from(le + ("Q" if is64 else "I"), data, off + (0x30 if is64 else 0x1C))
        aligns.append(align)
    return min(aligns) if aligns else None


def local_data_offset(f, info):
    f.seek(info.header_offset)
    hdr = f.read(30)
    n, m = struct.unpack("<HH", hdr[26:30])
    return info.header_offset + 30 + n + m


def main():
    if len(sys.argv) < 2:
        print(__doc__); return 2
    apk = sys.argv[1]
    report_path = sys.argv[sys.argv.index("--json") + 1] if "--json" in sys.argv else None
    results, failed_required = [], 0
    with zipfile.ZipFile(apk) as z, open(apk, "rb") as raw:
        for info in z.infolist():
            if not (info.filename.startswith("lib/") and info.filename.endswith(".so")):
                continue
            abi = info.filename.split("/")[1]
            align = elf_min_load_align(z.read(info))
            stored = info.compress_type == zipfile.ZIP_STORED
            zip_ok = stored and local_data_offset(raw, info) % PAGE == 0
            elf_ok = align is not None and align >= PAGE
            ok = elf_ok and zip_ok
            results.append({"lib": info.filename, "abi": abi, "elf_align": align,
                            "elf_ok": elf_ok, "zip_aligned": zip_ok, "ok": ok})
            if not ok and abi in REQUIRED_ABIS:
                failed_required += 1
    by_abi = {}
    for r in results:
        a = by_abi.setdefault(r["abi"], [0, 0]); a[0] += r["ok"]; a[1] += 1
    for abi, (good, total) in sorted(by_abi.items()):
        tag = "REQUIRED" if abi in REQUIRED_ABIS else "info"
        print(f"{abi:12} {good}/{total} libs 16KB-ready  [{tag}]")
    for r in results:
        if not r["ok"] and r["abi"] in REQUIRED_ABIS:
            print(f"  FAIL {r['lib']}: elf_align={r['elf_align']} zip_aligned={r['zip_aligned']}")
    if report_path:
        json.dump(results, open(report_path, "w"), indent=1)
    if not results:
        print("no native libraries found"); return 0
    print("RESULT:", "PASS" if failed_required == 0 else f"FAIL ({failed_required} required-ABI libs)")
    return 0 if failed_required == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
