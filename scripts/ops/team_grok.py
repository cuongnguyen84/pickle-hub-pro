"""Report-only Gemini adapter. No tools, no repo writes, no session resume.

The scheduled team keeps its collectors in Python. This call only reads the
measurement bundle already in the prompt and returns text. It does not edit
the repo or publish. Facebook and X posting stay on the Claude browser jobs.

The supervisor still labels this slot "grok" so a Telegram command cannot
switch it back to Claude. The HTTP call is Gemini, with GEMINI_API_KEY.
"""
import json
import os
import re
import socket
import urllib.error
import urllib.request
from pathlib import Path

# This host's IPv6 route stalls. Prefer IPv4, same as team_supervisor.
_getaddrinfo = socket.getaddrinfo
socket.getaddrinfo = lambda *a, **kw: sorted(_getaddrinfo(*a, **kw), key=lambda entry: entry[0] != socket.AF_INET)
if Path("/etc/ssl/cert.pem").exists():
    os.environ.setdefault("SSL_CERT_FILE", "/etc/ssl/cert.pem")

# Same id news-translate uses: this project's key accepts it on the free tier.
MODEL = "gemini-flash-lite-latest"
API = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


def body(prompt, model=MODEL):
    return {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2},
    }


def parse(status, raw):
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        payload = {}
    error = payload.get("error")
    message = error.get("message") if isinstance(error, dict) else (str(error) if error else "")
    text = ""
    candidates = payload.get("candidates") or []
    if candidates:
        parts = ((candidates[0].get("content") or {}).get("parts") or [])
        text = "".join((part.get("text") or "") for part in parts if isinstance(part, dict)).strip()
    usage_meta = payload.get("usageMetadata") or {}
    usage = {}
    if usage_meta:
        usage = {
            "prompt_tokens": usage_meta.get("promptTokenCount"),
            "completion_tokens": usage_meta.get("candidatesTokenCount"),
        }
    failed = status != 200 or not text
    return {
        "is_error": failed,
        "result": message or text or (raw or "")[:500],
        "provider": "gemini",
        "usage": usage,
        "total_cost_usd": None,
        "cost_status": "unknown_subscription_usage",
    }


def default_secret(key):
    if os.environ.get(key):
        return os.environ[key]
    paths = []
    if os.environ.get("SECRETS_FILE"):
        paths.append(Path(os.environ["SECRETS_FILE"]))
    repo = Path(os.environ.get("PICKLEHUB_REPO", Path(__file__).resolve().parents[2]))
    paths.append(repo / ".claude/secrets.local.md")
    for path in paths:
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        match = re.search(rf"(?m)^\s*{re.escape(key)}\s*[:=]?\s*([^\s#]+)", text)
        if match:
            return match.group(1)
    return None


def run(prompt, secret=None, model=MODEL):
    key = None
    if secret is not None:
        try:
            key = secret("GEMINI_API_KEY")
        except (SystemExit, Exception):
            key = None
    if not key:
        key = default_secret("GEMINI_API_KEY")
    if not key:
        return 1, parse(401, json.dumps({"error": {"message": "thiếu GEMINI_API_KEY"}}))
    req = urllib.request.Request(
        API.format(model=model), data=json.dumps(body(prompt, model)).encode(), method="POST",
        headers={"Content-Type": "application/json", "x-goog-api-key": key})
    try:
        with urllib.request.urlopen(req, timeout=300) as response:
            raw, status = response.read().decode(), response.status
    except urllib.error.HTTPError as exc:
        raw, status = exc.read().decode(errors="replace"), exc.code
    except urllib.error.URLError:
        return 1, parse(0, json.dumps({"error": {"message": "gemini_unreachable"}}))
    parsed = parse(status, raw)
    if key and key in str(parsed.get("result") or ""):
        parsed["result"] = str(parsed["result"]).replace(key, "[key]")
    return (1 if parsed["is_error"] else 0), parsed
