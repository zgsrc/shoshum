#!/usr/bin/env bash

set -euo pipefail

app_path="${1:-dist-electron/mac-universal/Shoshum.app}"
timeout_minutes="${NOTARIZATION_TIMEOUT_MINUTES:-180}"
poll_seconds="${NOTARIZATION_POLL_SECONDS:-30}"
work_dir="$(mktemp -d)"
submit_zip="$work_dir/Shoshum-notarization.zip"
submit_json="$work_dir/notary-submit.json"
info_json="$work_dir/notary-info.json"
info_error="$work_dir/notary-info-error.txt"
deadline=$((SECONDS + timeout_minutes * 60))

cleanup() {
  rm -rf "$work_dir"
}
trap cleanup EXIT

if [[ ! -d "$app_path" ]]; then
  echo "App bundle not found: $app_path" >&2
  exit 1
fi

if [[ -n "${APPLE_API_KEY:-}" ]]; then
  : "${APPLE_API_KEY_ID:?APPLE_API_KEY_ID is required with APPLE_API_KEY}"
  : "${APPLE_API_ISSUER:?APPLE_API_ISSUER is required with APPLE_API_KEY}"
  notary_args=(--key "$APPLE_API_KEY" --key-id "$APPLE_API_KEY_ID" --issuer "$APPLE_API_ISSUER")
else
  : "${APPLE_ID:?Set APPLE_API_KEY credentials or APPLE_ID}"
  : "${APPLE_APP_SPECIFIC_PASSWORD:?APPLE_APP_SPECIFIC_PASSWORD is required with APPLE_ID}"
  : "${APPLE_TEAM_ID:?APPLE_TEAM_ID is required with APPLE_ID}"
  notary_args=(--apple-id "$APPLE_ID" --password "$APPLE_APP_SPECIFIC_PASSWORD" --team-id "$APPLE_TEAM_ID")
fi

"$(dirname "$0")/verify-macos-app.sh" "$app_path"
ditto -c -k --keepParent --sequesterRsrc "$app_path" "$submit_zip"

xcrun notarytool submit "$submit_zip" \
  "${notary_args[@]}" \
  --output-format json \
  --no-s3-acceleration > "$submit_json"

submission_id="$(node -e 'const fs = require("fs"); console.log(JSON.parse(fs.readFileSync(process.argv[1], "utf8")).id)' "$submit_json")"
echo "Apple notarization submission: $submission_id"

while (( SECONDS < deadline )); do
  if xcrun notarytool info "$submission_id" \
    "${notary_args[@]}" \
    --output-format json > "$info_json" 2> "$info_error"; then
    status="$(node -e 'const fs = require("fs"); console.log(JSON.parse(fs.readFileSync(process.argv[1], "utf8")).status)' "$info_json")"
    echo "Notarization status: $status"

    case "$status" in
      Accepted)
        xcrun stapler staple -v "$app_path"
        "$(dirname "$0")/verify-macos-app.sh" "$app_path" true
        exit 0
        ;;
      Invalid|Rejected)
        xcrun notarytool log "$submission_id" "${notary_args[@]}" || true
        exit 1
        ;;
    esac
  else
    echo "Could not fetch notarization status; retrying." >&2
    sed -n '1,20p' "$info_error" >&2
  fi

  sleep "$poll_seconds"
done

echo "Notarization remained in progress for ${timeout_minutes} minutes." >&2
echo "Resume diagnosis with: xcrun notarytool info $submission_id <credentials>" >&2
exit 1
