#!/bin/zsh
# Runner for fetch_google_data.py — used by launchd and for manual runs.
# Creates a private venv inside this folder on first use (never installs
# anything globally) and runs the fetcher with it.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
VENV="$DIR/.venv"
if [[ ! -x "$VENV/bin/python" ]]; then
  echo "creating venv in $VENV (first run only)…"
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install --quiet --upgrade pip
  "$VENV/bin/pip" install --quiet -r "$DIR/requirements.txt"
fi
# macOS python.org builds ship without a CA bundle, so HTTPS calls fail with
# CERTIFICATE_VERIFY_FAILED in launchd's clean environment. Point OpenSSL at
# the venv's certifi bundle (certifi ships with requests) before running.
SSL_CERT_FILE="$("$VENV/bin/python" -c 'import certifi; print(certifi.where())')"
export SSL_CERT_FILE
exec "$VENV/bin/python" "$DIR/fetch_google_data.py" "$@"
