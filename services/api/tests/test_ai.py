import json

import pytest

from app.core.config import get_settings
from app.services import ai
from tests.test_identity_api import Token, auth, client, new_org  # noqa: F401
from tests.test_ledger_api import Org, fixed_today, org  # noqa: F401

FINDINGS = ["Payment PAY-0001 of USD 4,900.00 on 2026-11-01 names INV-1042, which totals USD 5,000.00.", "INV-1042 is short by USD 100.00. Calculated by venn, not by AI.", "No remittance advice is linked."]


def answer(*sentences: dict) -> str:  # type: ignore[type-arg]
    return json.dumps({"sentences": list(sentences)})


def test_only_cited_and_grounded_sentences_survive() -> None:
    good = {"text": "PAY-0001 paid 4,900.00 against INV-1042, leaving 100.00 open.", "cites": [1, 2]}
    kept, dropped = ai.validate(answer(
        good,
        {"text": "The customer probably deducted a fee.", "cites": []},                       # no citation
        {"text": "INV-1042 is short by 250.00.", "cites": [2]},                              # an amount that is in no finding
        {"text": "INV-9999 is also open.", "cites": [1]},                                    # a record that is in no finding
        {"text": "It was paid on 2026-10-30.", "cites": [1]},                                # a date that is in no finding
        {"text": "Nothing explains the gap.", "cites": [7]},                                 # a finding number that does not exist
        {"text": "No remittance advice is linked.", "cites": [3]},
    ), FINDINGS)
    assert [k["text"] for k in kept] == [good["text"], "No remittance advice is linked."] and dropped == 5
    assert kept[0]["cites"] == [1, 2]


def test_a_reply_that_is_not_the_expected_json_is_rejected() -> None:
    for bad in ("sure! here you go", "{}", '{"sentences": "x"}'):
        with pytest.raises(ValueError):
            ai.validate(bad, FINDINGS)
    assert ai.validate('```json\n{"sentences": []}\n```', FINDINGS) == ([], 0)


@pytest.fixture
def llm_on(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("VENN_LLM_API_KEY", "test-key")
    monkeypatch.setenv("VENN_LLM_MODEL", "test-model")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def short_case(o: Org) -> str:
    o.invoice(o.customer("Northwind Labs"), "5000.00", number="INV-1042")
    o.payment("4900.00", reference="INV-1042", payment_date="2026-11-01")
    o.post("/reconciliation/runs")
    return str(o.get("/investigations").json()["data"][0]["id"])


def test_off_by_default_so_no_case_data_leaves_the_system(org: Org, llm_on: None, monkeypatch: pytest.MonkeyPatch) -> None:
    called: list[int] = []
    monkeypatch.setattr(ai, "_call", lambda f: called.append(1) or "{}")
    cid = short_case(org)
    assert called == [] and org.get(f"/investigations/{cid}").json()["analysis"]["ai"] is None


def test_enabled_explanation_is_stored_cited_and_never_changes_the_recommendation(org: Org, llm_on: None, monkeypatch: pytest.MonkeyPatch) -> None:
    assert org.c.patch("/api/v1/settings/financial", json={"ai_enabled": True}, headers=org.h).status_code == 200
    seen: list[list[str]] = []

    def fake(findings: list[str]) -> str:
        seen.append(findings)
        return answer({"text": "The payment named INV-1042 but did not cover it.", "cites": [1]}, {"text": "The customer says it was a fee.", "cites": []})

    monkeypatch.setattr(ai, "_call", fake)
    cid = short_case(org)
    a = org.get(f"/investigations/{cid}").json()["analysis"]
    assert a["ai"]["status"] == "ok" and a["ai"]["prompt_version"] == "explain-1" and a["ai"]["dropped"] == 1 and a["ai"]["sentences"][0]["cites"] == [1]
    assert a["recommendation"]["action"] == "request_write_off" and a["status"] == "completed"  # chosen by the rules, not by the model
    assert all("Northwind" not in t for t in seen[0])  # the customer's name is never sent


def test_a_provider_failure_marks_the_explanation_failed_and_leaves_the_analysis_alone(org: Org, llm_on: None, monkeypatch: pytest.MonkeyPatch) -> None:
    assert org.c.patch("/api/v1/settings/financial", json={"ai_enabled": True}, headers=org.h).status_code == 200

    def boom(findings: list[str]) -> str:
        raise TimeoutError

    monkeypatch.setattr(ai, "_call", boom)
    cid = short_case(org)
    a = org.get(f"/investigations/{cid}").json()["analysis"]
    assert a["ai"]["status"] == "failed" and a["ai"]["sentences"] == [] and a["status"] == "completed" and len(a["findings"]) >= 2
