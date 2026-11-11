#!/usr/bin/env bash
# Builds the catalog page: template + raw JSON + images (base64) -> one HTML file.
# Usage: bash build.sh <image-dir> <out.html>
#   image-dir holds <imageId>.jpg files (main images at 400x400, colour images at 220x220 from cbu01.alicdn.com)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
IMGDIR="$1"; OUT="$2"
TMP="$(mktemp)"
{
  printf '{'
  first=1
  for f in "$IMGDIR"/*.jpg; do
    id="$(basename "$f" .jpg)"
    [ $first -eq 1 ] || printf ','
    first=0
    printf '"%s":"data:image/jpeg;base64,%s"' "$id" "$(base64 -w0 "$f")"
  done
  printf '}'
} > "$TMP"
RAW="$(tr -d '\n' < "$HERE/raw-basics.json")"
awk -v imgfile="$TMP" -v raw="$RAW" '
  BEGIN{ while((getline l < imgfile)>0) img=img l }
  { gsub(/\/\*IMGDATA\*\/\{\}/, "\001"); gsub(/\/\*RAWDATA\*\/\{\}/, "\002");
    n=split($0, parts, ""); out="";
    for(i=1;i<=n;i++){ c=parts[i]; if(c=="\001") out=out img; else if(c=="\002") out=out raw; else out=out c }
    print out }' "$HERE/catalog-template.html" > "$OUT"
rm -f "$TMP"
echo "built $OUT ($(du -h "$OUT" | cut -f1))"
