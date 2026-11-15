"""AI explanation of an investigation (MOD-11, E4). The model only rewrites the deterministic findings into a short explanation.

Rules it cannot break, each enforced here in code and not by asking nicely:
- it sees finding texts and their numbers, never customer names or free text written by people;
- every sentence must cite finding numbers that exist, and a sentence without a valid citation is dropped;
- a sentence that states an amount, date or record number that is not in the findings is dropped;
- it never chooses the recommended action, never writes to a record, and a failure leaves the case exactly as the rules produced it.
"""

import json
import logging
import re
from typing import Any

import httpx

from app.core.config import get_settings
from app.services.collections import check_text

log = logging.getLogger("venn.ai")
PROMPT_VERSION = "explain-1"
AMOUNT = r"\b\d{1,3}(?:,\d{3})*\.\d{2}\b|\b\d+\.\d{2}\b"
NUMBER = r"\b[A-Z][A-Z0-9]*-[A-Z0-9][A-Z0-9-]*\b"
SYSTEM = (
    "You explain a receivables case to a finance person. You are given numbered findings that were produced by software from the company's records. "
    "Write 2 to 4 short sentences that explain what happened and what is still unknown, using ONLY the findings. "
    'Every sentence must list the numbers of the findings it uses in "cites". Do not add any amount, date, name or invoice number that is not written in a finding. '
    "Do not give advice, do not recommend an action, do not guess a reason. If something is missing, say it is missing. "
    'Answer with JSON only: {"sentences": [{"text": "...", "cites": [1, 2]}]}'
)


def enabled(org_financial: dict[str, Any]) -> bool:
    c = get_settings()
    return bool(c.llm_api_key and c.llm_model) and bool(org_financial.get("ai_enabled"))


def _call(findings: list[str]) -> str:
    c = get_settings()
    body = {"model": c.llm_model, "temperature": 0, "max_tokens": 600, "response_format": {"type": "json_object"},
            "messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": "\n".join(f"{i}. {t}" for i, t in enumerate(findings, 1))}]}
    r = httpx.post("https://api.groq.com/openai/v1/chat/completions", json=body, timeout=25,
                   headers={"Authorization": f"Bearer {c.llm_api_key}", "Content-Type": "application/json", "User-Agent": "venn/1.0"})
    r.raise_for_status()
    return str(r.json()["choices"][0]["message"]["content"])


def validate(raw: str, findings: list[str]) -> tuple[list[dict[str, Any]], int]:
    """Keeps only grounded, cited sentences. Returns (kept, number dropped)."""
    try:
        items = json.loads(re.sub(r"^```(?:json)?|```$", "", raw.strip()))["sentences"]
        if not isinstance(items, list):
            raise TypeError
    except (ValueError, KeyError, TypeError):
        raise ValueError("The model did not return the expected JSON.") from None
    corpus = " ".join(findings)
    iso = r"\b\d{4}-\d{2}-\d{2}\b"
    facts = {"amounts": set(re.findall(AMOUNT, corpus)), "numbers": set(re.findall(NUMBER, corpus)), "dates": set(re.findall(r"\b\d{1,2} [A-Z][a-z]{2} \d{4}\b", corpus)) | set(re.findall(iso, corpus))}
    kept: list[dict[str, Any]] = []
    dropped = 0
    for it in items[:8]:
        text_s = str(it.get("text", "")).strip() if isinstance(it, dict) else ""
        cites = it.get("cites") if isinstance(it, dict) else None
        cited = isinstance(cites, list) and bool(cites) and all(isinstance(n, int) and 1 <= n <= len(findings) for n in cites)
        stray_iso = bool(set(re.findall(iso, text_s)) - facts["dates"])
        if not text_s or not cited or stray_iso or check_text(text_s, facts) is not None:
            dropped += 1
            continue
        kept.append({"text": text_s, "cites": sorted(set(cites or []))})
    return kept, dropped


def explain(findings: list[str]) -> dict[str, Any]:
    """Never raises: the explanation is optional. Returns the record stored with the analysis."""
    c = get_settings()
    base = {"model": c.llm_model, "prompt_version": PROMPT_VERSION}
    try:
        kept, dropped = validate(_call(findings), findings)
    except Exception as e:  # noqa: BLE001  # a provider outage or a bad answer must not touch the analysis
        log.warning("ai explanation failed: %s", type(e).__name__)
        return {**base, "status": "failed", "sentences": [], "dropped": 0}
    return {**base, "status": "ok" if kept else "empty", "sentences": kept, "dropped": dropped}
