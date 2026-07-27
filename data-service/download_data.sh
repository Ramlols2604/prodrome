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

set -euo pipefail

OUT_DIR="physionet_data"
mkdir -p "$OUT_DIR"
cd "$OUT_DIR"

echo "Downloading training set A (20,336 patients)..."
curl -L -o training_setA.zip \
  "https://archive.physionet.org/challenge/2019/training_setA.zip"

echo "Downloading training set B (20,000 patients)..."
curl -L -o training_setB.zip \
  "https://archive.physionet.org/challenge/2019/training_setB.zip"

echo "Unzipping..."
unzip -q -o training_setA.zip -d training
unzip -q -o training_setB.zip -d training

echo "Done. $(ls training/*.psv 2>/dev/null | wc -l) patient files in ./${OUT_DIR}/training"
echo ""
echo "Note: this is the full 40k-patient set. For faster local iteration"
echo "while building agent prompts, you can point --data-dir at a small"
echo "subset instead, e.g.:"
echo "  mkdir training_subset && cp training/p0000{01..50}.psv training_subset/"
echo "  python ../data_loader.py --data-dir training_subset"
