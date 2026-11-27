#!/usr/bin/env bash
set -euo pipefail

public="$(cd "$(dirname "${BASH_SOURCE[0]}")/../apps/mobile/public" && pwd)"
web="${1:-https://paisa.winplaybox.in}"
api="${2:-https://paisa-api.winplaybox.in}"
web="${web%/}"
api="${api%/}"
body="$(mktemp)"
trap 'rm -f "$body"' EXIT

failed=0
check_asset() {
  local path="$1" expected_type="$2" content_type
  if content_type="$(curl -fsSL --max-time 15 -o "$body" -w '%{content_type}' "$web/$path")" &&
    [[ "${content_type%%;*}" == "$expected_type" ]] &&
    cmp -s "$body" "$public/$path"; then
    printf 'OK %s\n' "$web/$path"
  else
    printf 'FAIL %s: expected deployed %s file (got %s)\n' "$web/$path" "$expected_type" "${content_type:-no response}" >&2
    failed=1
  fi
}

check_asset ads.txt text/plain
check_asset app-ads.txt text/plain
check_asset .well-known/assetlinks.json application/json
if curl -fsS --max-time 15 "$api/readyz" -o "$body" &&
  grep -Eq '"ok"[[:space:]]*:[[:space:]]*true' "$body"; then
  printf 'OK %s/readyz\n' "$api"
else
  printf 'FAIL %s/readyz\n' "$api" >&2
  failed=1
fi
exit "$failed"
