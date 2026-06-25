#!/usr/bin/env bash

set -euo pipefail

app_path="${1:-dist-electron/mac-universal/Shoshum.app}"
require_notarization="${2:-false}"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "macOS app verification must run on macOS." >&2
  exit 1
fi

if [[ ! -d "$app_path" ]]; then
  echo "App bundle not found: $app_path" >&2
  exit 1
fi

signature_details="$(codesign --display --verbose=4 "$app_path" 2>&1)"
printf '%s\n' "$signature_details"

if ! grep -q '^Authority=Developer ID Application:' <<<"$signature_details"; then
  echo "The app is not signed with a Developer ID Application certificate." >&2
  exit 1
fi

if grep -q '^TeamIdentifier=not set$' <<<"$signature_details"; then
  echo "The app signature does not contain an Apple Developer team identifier." >&2
  exit 1
fi

codesign --verify --deep --strict --verbose=2 "$app_path"

if [[ "$require_notarization" == "true" ]]; then
  xcrun stapler validate -v "$app_path"
  spctl --assess --type execute --verbose=4 "$app_path"
fi
