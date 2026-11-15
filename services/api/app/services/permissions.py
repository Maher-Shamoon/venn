"""Permission catalog and default role grants. Source: docs/planning/ROLE_PERMISSION_MATRIX.md.

The catalog is also snapshotted in migration 0002; add new keys with a new migration.
"""

# key, group, grantable_to_non_owner
CATALOG: list[tuple[str, str, bool]] = [
    ("dashboard.executive", "dashboard", True), ("dashboard.operational", "dashboard", True),
    ("customers.view", "customers", True), ("customers.manage", "customers", True),
    ("invoices.view", "invoices", True), ("invoices.manage", "invoices", True),
    ("invoices.import", "invoices", True),
    ("payments.view", "payments", True), ("payments.manage", "payments", True),
    ("payments.import", "payments", True),
    ("reconciliation.run", "reconciliation", True), ("reconciliation.allocate", "reconciliation", True),
    ("investigations.view", "investigations", True), ("investigations.manage", "investigations", True),
    ("investigations.assign", "investigations", True),
    ("collections.view", "collections", True), ("collections.draft", "collections", True),
    ("collections.send", "collections", True),
    ("disputes.view", "disputes", True), ("disputes.manage", "disputes", True),
    ("documents.view", "documents", True), ("documents.upload", "documents", True),
    ("adjustments.request", "approvals", True),
    ("approvals.view_own", "approvals", True), ("approvals.decide", "approvals", False),
    ("analytics.view", "analytics", True),
    ("reports.operational", "analytics", True), ("reports.financial", "analytics", True),
    ("reports.export", "analytics", True),
    ("integrations.view", "integrations", True), ("integrations.manage", "integrations", False),
    ("team.view", "team", True), ("team.manage", "team", False),
    ("audit.view", "audit", True),
    ("settings.view", "settings", True), ("settings.manage", "settings", False),
    ("remittance.manage", "settings", False),
]

ALL_KEYS = frozenset(k for k, _, _ in CATALOG)
NON_GRANTABLE = frozenset(k for k, _, g in CATALOG if not g)

# AR specialist defaults: everything except the owner-only and the "off by default" rows of the matrix.
_AR_OFF = {"dashboard.executive", "collections.send", "reports.financial", "audit.view", "settings.view"}
AR_DEFAULT = ALL_KEYS - NON_GRANTABLE - _AR_OFF

# Rows the matrix says the owner cannot switch off for AR ("No (always on)").
AR_ALWAYS_ON = frozenset({
    "dashboard.operational", "customers.view", "invoices.view", "payments.view",
    "investigations.view", "approvals.view_own",
})
