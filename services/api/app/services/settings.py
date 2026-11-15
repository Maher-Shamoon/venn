import json
import uuid
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.core.requestinfo import RequestInfo
from app.core.security import AuthUser
from app.services import audit

FINANCIAL_DEFAULTS = {"default_terms_days": 30, "auto_apply_exact": True, "short_grace_days": 7, "claim_grace_days": 5}


class CompanyIn(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    legal_name: str | None = Field(default=None, max_length=200)
    website: str | None = Field(default=None, max_length=300)
    industry: str | None = Field(default=None, max_length=100)
    company_size: str | None = Field(default=None, max_length=50)
    country: str | None = Field(default=None, min_length=2, max_length=2)

    @field_validator("name")
    @classmethod
    def _name(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("Organization name is required.")
        return v.strip() if v else v


class FinancialIn(BaseModel):
    default_currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")
    timezone: str | None = None
    default_terms_days: int | None = Field(default=None, ge=1, le=365)
    auto_apply_exact: bool | None = None
    short_grace_days: int | None = Field(default=None, ge=0, le=90)
    claim_grace_days: int | None = Field(default=None, ge=0, le=90)

    @field_validator("timezone")
    @classmethod
    def _tz(cls, v: str | None) -> str | None:
        if v is not None:
            try:
                ZoneInfo(v)
            except (ZoneInfoNotFoundError, ValueError) as e:
                raise ValueError("Unknown time zone.") from e
        return v


def read(db: Session) -> dict[str, Any]:
    r = db.execute(text("select name, legal_name, website, industry, company_size, country, default_currency, timezone, "
                        "settings, version from organizations")).one()
    fin = {**FINANCIAL_DEFAULTS, **(r.settings or {}).get("financial", {})}
    return {
        "company": {"name": r.name, "legal_name": r.legal_name, "website": r.website, "industry": r.industry,
                    "company_size": r.company_size, "country": r.country.strip()},
        "financial": {"default_currency": r.default_currency.strip(), "timezone": r.timezone, **fin},
        "version": r.version,
    }


def _check_version(db: Session, org: uuid.UUID, expected: int | None) -> None:
    if expected is not None and db.execute(text("select version from organizations where id = :o"), {"o": org}).scalar_one() != expected:
        raise ApiError(409, "version_conflict", "Someone else changed these settings. Reload to see the latest.")


def update_company(db: Session, org: uuid.UUID, actor: AuthUser, body: CompanyIn, expected: int | None, info: RequestInfo) -> dict[str, Any]:
    _check_version(db, org, expected)
    before = read(db)["company"]
    changes = body.model_dump(exclude_none=True)
    if changes:
        sets = ", ".join(f"{k} = :{k}" for k in changes)  # keys come from the CompanyIn model, never from the request
        db.execute(text(f"update organizations set {sets}, version = version + 1, updated_at = now()"), changes)  # noqa: S608
        audit.record(db, org, "settings.company_updated", actor_id=actor.id, record_type="organization", record_id=org,
                     before=before, after=read(db)["company"], info=info)
    return read(db)


def update_financial(db: Session, org: uuid.UUID, actor: AuthUser, body: FinancialIn, expected: int | None, info: RequestInfo) -> dict[str, Any]:
    _check_version(db, org, expected)
    before = read(db)["financial"]
    c = body.model_dump(exclude_none=True)
    if c:
        cols: dict[str, Any] = {k: c.pop(k) for k in ("default_currency", "timezone") if k in c}
        current = db.execute(text("select settings from organizations")).scalar_one() or {}
        merged = {**current, "financial": {**current.get("financial", {}), **c}}
        sets = "".join(f"{k} = :{k}, " for k in cols)  # fixed column names
        db.execute(text(f"update organizations set {sets}settings = cast(:s as jsonb), version = version + 1, updated_at = now()"),  # noqa: S608
                   {**cols, "s": json.dumps(merged)})
        audit.record(db, org, "settings.financial_updated", actor_id=actor.id, record_type="organization", record_id=org,
                     before=before, after=read(db)["financial"], info=info)
    return read(db)
