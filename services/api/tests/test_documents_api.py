from fastapi.testclient import TestClient

from app.services.documents import clean_name, sniff
from tests.test_identity_api import Token, auth, client, new_org  # noqa: F401
from tests.test_ledger_api import Org, fixed_today, org  # noqa: F401


def make_pdf(words: str) -> bytes:
    """A one-page PDF written by hand, so the test needs no PDF library."""
    stream = f"BT /F1 18 Tf 72 720 Td ({words}) Tj ET".encode()
    objs = [b"<< /Type /Catalog /Pages 2 0 R >>", b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
            b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream", b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
    out, offsets = b"%PDF-1.4\n", []
    for n, body in enumerate(objs, 1):
        offsets.append(len(out))
        out += f"{n} 0 obj\n".encode() + body + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode() + b"".join(f"{o:010d} 00000 n \n".encode() for o in offsets)
    return out + f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()


def up(o: Org, name: str, data: bytes, **q: str):  # type: ignore[no-untyped-def]
    qs = "&".join(f"{k}={v}" for k, v in q.items())
    return o.c.post(f"/api/v1/documents{'?' + qs if qs else ''}", files={"file": (name, data, "application/octet-stream")}, headers=o.h)


def test_pdf_text_is_extracted_and_searchable_and_download_is_safe(org: Org) -> None:
    r = up(org, "Remittance advice.pdf", make_pdf("Paid INV-1042 less bank fee 25.00"))
    assert r.status_code == 201, r.text
    d = r.json()
    assert d["content_type"] == "application/pdf" and d["extraction"] == "done" and d["page_count"] == 1 and "bank fee 25.00" in d["text_preview"]
    assert org.get("/documents?q=bank fee").json()["total"] == 1 and org.get("/documents?q=nothing here").json()["total"] == 0
    dl = org.c.get(f"/api/v1/documents/{d['id']}/download", headers=org.h)
    assert dl.status_code == 200 and dl.content.startswith(b"%PDF-") and dl.headers["x-content-type-options"] == "nosniff" and "attachment" in dl.headers["content-disposition"]
    assert any(e["action"] == "document.uploaded" for e in org.get("/audit-events?limit=20").json()["data"])


def test_type_is_decided_from_the_bytes_not_the_name(org: Org) -> None:
    assert up(org, "invoice.pdf", b"MZ\x90\x00 this is a program").status_code == 415
    assert up(org, "notes.txt", b"\x00\x01\x02binary").status_code == 415
    assert up(org, "page.html", b"<html><script>alert(1)</script></html>").status_code == 415
    assert up(org, "empty.txt", b"").status_code == 422
    png = up(org, "scan.png", b"\x89PNG\r\n\x1a\n" + b"0" * 50)
    assert png.status_code == 201 and png.json()["extraction"] == "none" and "OCR" in png.json()["extraction_note"]
    broken = up(org, "broken.pdf", b"%PDF-1.4 not really a pdf")
    assert broken.status_code == 201 and broken.json()["extraction"] == "failed"
    assert sniff("a.csv", b"a,b\n1,2\n") == "csv" and clean_name("..\\..\\evil/../x<>.pdf") == "x__.pdf"


def test_size_limit_and_duplicate_uploads(org: Org) -> None:
    assert up(org, "big.txt", b"a" * (20 * 1024 * 1024 + 1)).status_code == 413
    first = up(org, "a.txt", b"same content")
    again = up(org, "renamed.txt", b"same content")
    assert first.status_code == 201 and again.status_code == 200 and again.json()["id"] == first.json()["id"]
    assert org.get("/documents").json()["total"] == 1


def test_document_becomes_evidence_and_cannot_be_deleted_while_the_case_is_open(org: Org) -> None:
    inv = org.invoice(org.customer("Northwind Labs"), "5000.00", number="INV-1042")
    org.payment("4000.00", reference="INV-1042", payment_date="2026-11-01")
    org.post("/reconciliation/runs")
    case = org.get("/investigations").json()["data"][0]
    assert org.get(f"/investigations/{case['id']}").json()["analysis"]["status"] == "insufficient_evidence"
    r = up(org, "remittance.pdf", make_pdf("Customer deducted 1000 for returned goods"), investigation_id=case["id"])
    assert r.status_code == 201 and r.json()["linked"] is True
    assert up(org, "remittance.pdf", make_pdf("Customer deducted 1000 for returned goods"), investigation_id=case["id"]).json()["linked"] is False  # linking twice does nothing
    d = org.get(f"/investigations/{case['id']}").json()
    assert d["analysis"]["stale"] is True and any(e["type"] == "document" and e["label"] == "remittance.pdf" for e in d["evidence"])
    assert org.get(f"/documents/{r.json()['id']}").json()["linked_cases"][0]["number"] == case["number"]
    gone = org.c.delete(f"/api/v1/documents/{r.json()['id']}", headers=org.h)
    assert gone.status_code == 409 and gone.json()["code"] == "in_use"
    assert org.post(f"/investigations/{case['id']}/dismiss", {"reason": "Not needed"}).status_code == 200
    assert org.c.delete(f"/api/v1/documents/{r.json()['id']}", headers=org.h).status_code == 204
    assert org.get("/documents").json()["total"] == 0 and org.get(f"/documents/{r.json()['id']}").status_code == 404
    assert inv["id"]


def test_other_organizations_cannot_read_documents(org: Org, client: TestClient, auth: Token) -> None:  # noqa: F811
    did = up(org, "secret.txt", b"private notes").json()["id"]
    other = Org(client, auth, "Other Co")
    assert other.get(f"/documents/{did}").status_code == 404
    assert other.c.get(f"/api/v1/documents/{did}/download", headers=other.h).status_code == 404
    assert other.get("/documents").json()["total"] == 0
