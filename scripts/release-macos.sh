#!/usr/bin/env bash

set -euo pipefail

signing_env="${SHOSHUM_SIGNING_ENV:-.env.signing.local}"
developer_id_fingerprint="58C04F14554D34A1D75D7CF3AD257A7F0B97FCA8"
if [[ -f "$signing_env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$signing_env"
  set +a
fi

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "The macOS release must be built on macOS." >&2
  exit 1
fi

if security find-identity -v -p codesigning 2>/dev/null | grep -q "$developer_id_fingerprint"; then
  # Avoid importing a second copy when the exact identity is already installed.
  unset CSC_LINK CSC_KEY_PASSWORD
fi

if [[ -n "${CSC_LINK:-}" && -z "${CSC_KEY_PASSWORD:-}" ]]; then
  echo "CSC_KEY_PASSWORD is required when CSC_LINK is configured." >&2
  exit 1
fi

if [[ -z "${CSC_LINK:-}" ]] && ! security find-identity -v -p codesigning | grep -q 'Developer ID Application:'; then
  echo "No Developer ID Application identity was found in the keychain and CSC_LINK is not set." >&2
  exit 1
fi

npm run electron:generate-icons
npm run electron:build-web
npx electron-builder --config electron-builder.config.js --mac dir --universal --publish never
bash scripts/verify-macos-app.sh
bash scripts/notarize-macos-app.sh
npx electron-builder --config electron-builder.config.js --mac dmg zip --universal \
  --prepackaged dist-electron/mac-universal/Shoshum.app --publish never
