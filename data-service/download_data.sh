#!/usr/bin/env bash
# Downloads the real PhysioNet/CinC Challenge 2019 sepsis prediction
# training data. No account, no credentialing, no DUA -- this dataset
# is fully open (unlike MIMIC).
#
# Usage:
#   ./download_data.sh
#
# After it finishes, point the loader at the real data instead of the
# synthetic sample set:
#   python data_loader.py --data-dir physionet_data/training
#
# Note: archive.physionet.org/challenge/2019/training_set{A,B}.zip now
# 404. The same PSVs are on the PhysioNet open S3 bucket.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT_DIR="$ROOT/physionet_data/training"
mkdir -p "$OUT_DIR"
export PRODROME_PHYSIONET_OUT="$OUT_DIR"

echo "Downloading PhysioNet Challenge 2019 training sets A+B from S3..."
python3 - <<'PY'
import os
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

BUCKET = "https://physionet-open.s3.amazonaws.com"
PREFIXES = [
    "challenge-2019/1.0.0/training/training_setA/",
    "challenge-2019/1.0.0/training/training_setB/",
]
NS = {"s3": "http://s3.amazonaws.com/doc/2006-03-01/"}
OUT = Path(os.environ["PRODROME_PHYSIONET_OUT"])
WORKERS = 32


def list_keys(prefix: str):
    keys = []
    token = None
    while True:
        params = {"list-type": "2", "prefix": prefix}
        if token:
            params["continuation-token"] = token
        url = f"{BUCKET}?{urllib.parse.urlencode(params)}"
        with urllib.request.urlopen(url) as resp:
            root = ET.fromstring(resp.read())
        for contents in root.findall("s3:Contents", NS):
            key = contents.find("s3:Key", NS).text
            if key and key.endswith(".psv"):
                keys.append(key)
        truncated = root.find("s3:IsTruncated", NS)
        if truncated is not None and truncated.text == "true":
            token_el = root.find("s3:NextContinuationToken", NS)
            token = token_el.text if token_el is not None else None
            if not token:
                break
        else:
            break
    return keys


def download_one(key: str) -> str:
    dest = OUT / Path(key).name
    if dest.exists() and dest.stat().st_size > 0:
        return "skip"
    url = f"{BUCKET}/{urllib.parse.quote(key)}"
    tmp = dest.with_suffix(".psv.part")
    last_exc = None
    for attempt in range(1, 4):
        try:
            urllib.request.urlretrieve(url, tmp)
            tmp.replace(dest)
            return "ok"
        except Exception as exc:
            last_exc = exc
            if tmp.exists():
                tmp.unlink()
            time.sleep(attempt)
    raise last_exc


def main():
    print("Listing training PSVs...", flush=True)
    keys = []
    for prefix in PREFIXES:
        found = list_keys(prefix)
        print(f"  {prefix}: {len(found)} files", flush=True)
        keys.extend(found)
    print(
        f"Downloading {len(keys)} files into {OUT} ({WORKERS} workers)...",
        flush=True,
    )
    ok = skip = fail = 0
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {pool.submit(download_one, key): key for key in keys}
        done = 0
        for fut in as_completed(futures):
            done += 1
            try:
                status = fut.result()
            except Exception as exc:
                fail += 1
                print(f"FAIL {futures[fut]}: {exc}", file=sys.stderr, flush=True)
            else:
                if status == "skip":
                    skip += 1
                else:
                    ok += 1
            if done % 1000 == 0 or done == len(keys):
                print(
                    f"  progress {done}/{len(keys)} "
                    f"(new={ok} skip={skip} fail={fail})",
                    flush=True,
                )
    if fail:
        raise SystemExit(f"Download finished with {fail} failures")
    n = len(list(OUT.glob("*.psv")))
    print(f"Done. {n} patient files in {OUT}")


if __name__ == "__main__":
    main()
PY

echo ""
echo "Note: this is the full ~40k-patient set. For faster local iteration"
echo "while building agent prompts, you can point --data-dir at a small"
echo "subset instead, e.g.:"
echo "  mkdir training_subset && cp physionet_data/training/p0000{01..50}.psv training_subset/"
echo "  python data_loader.py --data-dir training_subset"
