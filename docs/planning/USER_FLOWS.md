# Venn — User Flows

Status: Phase 1 draft · Last updated 2026-11-13

Diagrams are Mermaid. Each flow lists its failure paths, because those are where products feel broken.

## 1. Signup and onboarding

```mermaid
flowchart TD
    A[Visitor on marketing site] --> B[/signup: name, work email, password/]
    B --> C{Email already registered?}
    C -- Yes --> C1[Generic 'check your email' message<br/>email offers sign-in or reset]
    C -- No --> D[Supabase creates user, sends verification email]
    D --> E[/verify-email: waiting screen with resend/]
    E --> F{Link clicked and valid?}
    F -- Expired --> E
    F -- Yes --> G{Pending invitation for this email?}
    G -- Yes --> INV[Go to invitation acceptance flow]
    G -- No --> H[Onboarding 1: Create organization<br/>name, industry, size, country, currency, website?]
    H --> I[Org + Owner membership + system roles created in one transaction]
    I --> J[Onboarding 2: Connect financial sources - skippable]
    J --> K[Onboarding 3: Connect email - skippable]
    K --> L[Onboarding 4: Import records - skippable<br/>or load labelled sample data]
    L --> M[Onboarding 5: Invite employees - skippable]
    M --> N[Onboarding 6: Preferences<br/>timezone, approval defaults]
    N --> O[Owner dashboard with setup checklist]
```

Notes
- Steps 2–6 are skippable and resumable; progress is stored on the organization (`onboarding_state`).
- The signup response never reveals whether an email is registered (prevents account enumeration).
- "Sample data" is clearly labelled demonstration data and can be removed in one action. **Decision D-11.**

## 2. Login and application routing

```mermaid
flowchart TD
    A[/login/] --> B[Supabase verifies credentials]
    B -- Invalid --> A1[Generic error, rate limited]
    B -- Valid, email unverified --> V[/verify-email/]
    B -- Valid --> C[GET /api/v1/me]
    C --> D{Active memberships?}
    D -- None, pending invite --> INV[Invitation acceptance]
    D -- None --> ONB[Create organization]
    D -- One --> E[Load role + permissions]
    D -- Several --> SW[Organization picker] --> E
    D -- Only suspended --> S[Access suspended screen]
    E --> F{dashboard.executive?}
    F -- Yes --> OD[/app/dashboard - Owner view/]
    F -- No --> AD[/app/dashboard - AR view/]
```

## 3. Employee invitation

```mermaid
sequenceDiagram
    actor Owner
    participant Web as Venn Web
    participant API as Venn API
    participant DB as PostgreSQL
    participant Mail as Email service
    actor Emp as Employee

    Owner->>Web: Settings → Team → Invite (email, role)
    Web->>API: POST /members/invitations
    API->>API: require team.manage; check not already member
    API->>DB: insert invitation (token hash, role, expires in 7 days) + audit
    API->>Mail: invitation email with single-use link
    Mail-->>Emp: "Owner invited you to <Org> on Venn"
    Emp->>Web: opens /invite/{token}
    Web->>API: GET /invitations/{token}
    API-->>Web: org name, role, invited email (or expired/used)
    alt No Venn account
        Emp->>Web: sets name + password (email fixed to invited address)
        Web->>API: signup; email treated as verified via token possession
    else Has account
        Emp->>Web: signs in with the invited email
    end
    Web->>API: POST /invitations/{token}/accept
    API->>API: authenticated email must equal invited email
    API->>DB: create membership in EXISTING org, mark invitation accepted, audit
    API-->>Web: membership
    Web-->>Emp: AR Specialist dashboard
    API-->>Owner: notification "Employee joined"
```

Failure paths: expired → "ask your admin to resend"; already used → sign-in prompt; signed in as a different email → explain and offer sign-out; invited role no longer exists → the invitation is invalidated (it does not silently fall back to another role).

## 4. Navigation by role

```mermaid
flowchart LR
    subgraph Shared shell
      SB[Sidebar] --- TB[Top bar: search, notifications, org, profile]
    end

    subgraph Owner
      O1[Dashboard - Executive]
      O2[Customers]
      O3[Invoices]
      O4[Payments]
      O5[Reconciliation]
      O6[Investigations]
      O7[Collections]
      O8[Disputes]
      O9[Approvals]
      O10[Analytics & Reports]
      O11[Integrations]
      O12[Team]
      O13[Audit log]
      O14[Settings]
    end

    subgraph AR Specialist
      A1[Dashboard - My work]
      A2[Customers]
      A3[Invoices]
      A4[Payments]
      A5[Reconciliation]
      A6[Investigations]
      A7[Collections]
      A8[Disputes]
      A9[My requests]
      A10[Reports - operational]
    end

    SB --> O1 & A1
```

Sidebar grouping (both roles; items hidden when the permission is absent):

| Group | Owner | AR Specialist |
|---|---|---|
| — | Dashboard | Dashboard |
| Receivables | Customers, Invoices, Payments | Customers, Invoices, Payments |
| Work | Reconciliation, Investigations, Collections, Disputes | Reconciliation, Investigations, Collections, Disputes |
| Control | Approvals (count), Analytics, Reports | My requests (count), Reports |
| Admin | Integrations, Team, Audit log, Settings | — |

## 5. Import → reconciliation

```mermaid
flowchart TD
    A[Upload CSV] --> B[Hash file; warn if seen before]
    B --> C[Column mapping - remembered per org and source]
    C --> D[Validate rows: types, dates, decimals, currency]
    D --> E[Preview: valid / warnings / errors / duplicates]
    E --> F{User confirms}
    F -- Cancel --> X[Batch discarded]
    F -- Confirm --> G[Background job inserts valid rows idempotently]
    G --> H[Import summary + downloadable error rows]
    H --> I{Payments imported?}
    I -- Yes --> J[Reconciliation run]
    I -- No --> K[Invoices list]
    J --> L[Rules R1..R8 per payment]
    L --> M1[Exact → auto-apply if enabled]
    L --> M2[Probable → suggestion for review]
    L --> M3[None → unmatched]
    L --> M4[Anomaly → discrepancy]
    M2 --> N[AR reviews: confirm / edit / reject]
    M4 --> O[Investigation opened]
```

## 6. Investigation lifecycle (user view)

```mermaid
stateDiagram-v2
    [*] --> New: discrepancy detected or opened manually
    New --> Investigating: engine gathers evidence
    Investigating --> ReadyForReview: analysis produced
    Investigating --> ReadyForReview: analysis failed (manual mode)
    ReadyForReview --> Investigating: re-run with new evidence
    ReadyForReview --> AwaitingApproval: action needs approval
    ReadyForReview --> ActionTaken: action allowed directly
    AwaitingApproval --> ActionTaken: approved
    AwaitingApproval --> ReadyForReview: rejected or more evidence requested
    ActionTaken --> Monitoring: waiting for financial result
    Monitoring --> Resolved: outcome verified or recorded
    Monitoring --> ReadyForReview: follow-up date passed, nothing received
    ReadyForReview --> Dismissed: not a discrepancy (reason required)
    Resolved --> [*]
    Dismissed --> [*]
```

Resolution outcomes: `recovered_verified`, `partially_recovered`, `adjusted` (credit/discount/write-off approved), `customer_correct`, `duplicate_refund_recorded`, `no_discrepancy`, `unrecoverable`.

## 7. Human approval

```mermaid
sequenceDiagram
    actor AR as AR Specialist
    participant API
    participant Pol as Policy service
    participant DB
    actor Own as Owner

    AR->>API: POST action (e.g. write-off 1,000.00 on INV-1042)
    API->>API: require adjustments.request
    API->>Pol: needs approval? (type, amount, actor)
    alt Not required
        Pol-->>API: execute
        API->>DB: apply + audit (one transaction)
    else Required
        Pol-->>API: approval required
        API->>DB: approval(pending) with payload snapshot + evidence refs + audit
        API-->>AR: 202 "Submitted for approval"
        API-->>Own: notification
        Own->>API: GET /approvals/{id} (payload, impact, evidence, history)
        alt Approve
            Own->>API: POST /approvals/{id}/approve (comment)
            API->>API: require approvals.decide; decider ≠ requester
            API->>DB: re-validate payload against current record state
            alt Still valid
                API->>DB: approval(approved) + execute action + audit (one transaction)
            else Record changed
                API->>DB: approval(stale)
                API-->>Own: "Invoice changed since request — ask requester to resubmit"
            end
        else Reject
            Own->>API: POST /approvals/{id}/reject (reason required)
            API->>DB: approval(rejected) + audit
        else Request more evidence
            Own->>API: POST /approvals/{id}/request-info
            API->>DB: approval(info_requested); returns to requester
        end
        API-->>AR: notification with decision
    end
```

Key rule: the approved payload is a **snapshot**. Execution re-validates it; if the invoice balance changed since the request, the approval becomes *stale* rather than applying an outdated amount.

## 8. Collections

```mermaid
flowchart TD
    A[Nightly job: invoices past due with open balance] --> B[Create/update collection case per customer+invoice]
    B --> C[Priority score: amount × days overdue, broken promises, dispute flag]
    C --> D[AR opens case from queue]
    D --> E[Generate draft from invoice facts + timeline]
    E --> F[AR edits]
    F --> G{Has collections.send and template is standard?}
    G -- Yes --> H[Send via connected mailbox]
    G -- No --> I[Submit for approval] --> J{Owner}
    J -- Approve --> H
    J -- Reject --> F
    H --> K[Timeline entry + next follow-up date]
    K --> L{Payment imported and allocated?}
    L -- Full --> M[Case closed - paid]
    L -- Partial --> N[Case stays open, balance updated]
    L -- Reply disputes invoice --> O[Create dispute; reminders paused]
```

If no mailbox is connected the Send action becomes **Copy / mark as sent manually**, logged as a manual activity. Venn does not pretend to have sent anything.

## 9. Dispute

```mermaid
stateDiagram-v2
    [*] --> Open
    Open --> UnderReview: assigned
    UnderReview --> AwaitingCustomer: information requested
    AwaitingCustomer --> UnderReview: customer responded
    UnderReview --> AwaitingInternalApproval: adjustment proposed
    AwaitingInternalApproval --> Resolved: approved and applied
    AwaitingInternalApproval --> UnderReview: approval rejected
    UnderReview --> Resolved: upheld / partially upheld without adjustment
    UnderReview --> Rejected: customer claim not supported
    Resolved --> [*]
    Rejected --> [*]
```

## 10. Integration connection

```mermaid
sequenceDiagram
    actor Owner
    participant Web
    participant API
    participant Prov as Provider (Google / Intuit / Stripe)
    participant W as Worker

    Owner->>Web: Integrations → Connect
    Web->>API: POST /integrations/{provider}/connect
    API->>API: require integrations.manage; create state + PKCE, bind to org and user
    API-->>Web: provider authorization URL
    Web->>Prov: redirect, user consents to listed scopes
    Prov->>API: callback (code, state)
    API->>API: verify state, exchange code
    API->>API: encrypt tokens, store connection(status=connecting) + audit
    API->>Prov: test call (e.g. profile / company info)
    alt Success
        API->>W: enqueue initial sync
        API-->>Web: status = connected, scopes shown
    else Failure
        API-->>Web: status = error with provider message
    end
    W->>Prov: paged sync with cursor
    W->>API: upsert by external_id (idempotent), sync_run record
```

## 11. Flow coverage of end-to-end scenarios

| Scenario | Flows |
|---|---|
| A New org signup/onboarding | §1, §2 |
| B Invitation | §3 |
| C Invoice import with duplicates | §5 |
| D Payment import and reconciliation | §5 |
| E Discrepancy → investigation | §5, §6 |
| F Approved action → verified outcome | §6, §7 |
| G Collection email | §8, §7 |
| H Dispute | §9 |
| I Owner approval | §7 |
| J Cross-tenant denial | All API calls; see TESTING_STRATEGY |
