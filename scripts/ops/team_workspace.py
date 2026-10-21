"""Path policy for reviewable patches. The model call itself is Grok, report only.

draft() does not open a worktree and does not call Claude. Facebook and X
posting are the only scheduled Claude jobs.
"""
from __future__ import annotations

import re
from pathlib import Path


def permitted(path, role):
    p = Path(path)
    if p.is_absolute() or ".." in p.parts or any(part.startswith(".") for part in p.parts):
        return False
    if re.search(r"auth|payment|checkout|sepay|secret|permission|recovery|otp|dupr|legacy|scoring|registration|risk-tier", path, re.I):
        return False
    if role == "editorial":
        return path.startswith("docs/agent-drafts/") and p.suffix == ".md"
    return (path.startswith("src/") and p.suffix in {".ts", ".tsx", ".css"}
            and not path.startswith(("src/integrations/", "src/contracts/"))) or (
            path.startswith("docs/agent-drafts/") and p.suffix == ".md")


def draft(store, role, request, task_id):
    return {"error": "report_only_provider"}
