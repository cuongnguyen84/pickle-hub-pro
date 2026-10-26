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
exec "$VENV/bin/python" "$DIR/fetch_google_data.py" "$@"
