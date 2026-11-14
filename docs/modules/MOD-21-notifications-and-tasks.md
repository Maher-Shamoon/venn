# MOD-21 Notifications and tasks

Spec: FEATURE_SPECIFICATION §B.17 · Roadmap: M6 (in-app), M12 (tasks from follow-ups), M14 (email notifications) · Code: `Admin.tsx` (Notifications, Tasks), `Shell.tsx` (bell), `Dash.tsx` (AR tasks), `store.ts` (`markRead`, `toggleTask`, `addTask`, `note`)

## 1. Purpose
Tell the right person when something needs them, and keep a short list of what each person has to do.

## 2. Scope
| In | Out |
|---|---|
| Bell popover (latest 5, unread dot, Mark all read, See all); notifications page with All/Unread and click-through | Push/mobile notifications, Slack [P] |
| Events: approval requested/decided, assignment, mention in a note, import finished/failed, integration needs attention, follow-up due, remittance change | |
| Email notifications for approvals and assignments, per-user preferences | |
| Tasks: add with due date, tick done, linked record, system-created tasks from follow-ups and missing evidence; AR dashboard list | Recurring tasks |

## 3. Actors
Every user · System (event producers, outbox)

## 4. Use cases
| ID | Use case | Main flow | Alternatives | Result |
|---|---|---|---|---|
| UC-21-01 | Notice something new | Bell shows a dot → open → click item | — | Opens record; item read |
| UC-21-02 | Clear notifications | Mark all read | — | Unread 0 |
| UC-21-03 | Add a task | Tasks → type title, due date → Add | Empty title → button disabled | Task listed |
| UC-21-04 | Finish a task | Tick | — | Done; struck through |
| UC-21-05 | Get system tasks | Follow-up date reached / evidence requested | — | Task created with link |
| UC-21-06 | Choose email notifications | Profile → toggles | — | Preferences saved |

## 5. Functional requirements
| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-21-01 | Notifications per user with read state; bell shows latest 5 and unread indicator. | Must | UI |
| FR-21-02 | Each notification links to its record. | Must | Partial: some items not linked |
| FR-21-03 | Events listed in scope are produced by the owning modules through the outbox. | Must | Partial: a subset locally |
| FR-21-04 | Email notifications honour per-user preferences; daily digest option. | Should | Partial: toggles only |
| FR-21-05 | Tasks: title, due date, assignee, linked record, status; add and toggle. | Must | UI |
| FR-21-06 | System tasks from collections follow-up dates and missing-evidence requests. | Should | None |
| FR-21-07 | Unread count updates without reload (poll 60 s or after mutations). | Must | Partial |

## 6. Non-functional requirements
| ID | Requirement | Measure |
|---|---|---|
| NFR-21-01 | A notification is produced at most once per event (dedupe key). | API test |
| NFR-21-02 | Notification email delivery ≤ 2 min p95. | Staging measurement |

## 7. Test cases
| ID | FR | Level | Steps | Expected |
|---|---|---|---|---|
| TC-21-01 | 01 | E | Mark all read | Unread 4 → 0 (verified) |
| TC-21-02 | 03 | A | Submit an approval request | Approver gets one notification |
| TC-21-03 | 05 | E | Add task "Call Meridian AP" | Listed (verified) |
| TC-21-04 | 04 | A | Turn off approval emails, request approval | In-app only, no email |
| TC-21-05 | 06 | A | Collection next date reached | Task for the case owner |
| TC-21-06 | NFR-21-01 | A | Replay the same event | Still one notification |

## 8. Backend contract
`GET /notifications?unread=&cursor=` · `POST /notifications/read-all` · `POST /notifications/{id}/read` · `GET/POST /tasks` · `PATCH /tasks/{id}` · `GET/PUT /me/notification-preferences`. Tables: `notifications`, `tasks`, `outbox_messages`, `notification_preferences`.
