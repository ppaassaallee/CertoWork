# Client Portal — QA

Verification checklist for projection, rules, auth, portal UX, team tab, and transition.

## Projection

- [ ] Enabling each `PortalSettings` flag adds exactly that section under `client_portal/{clientId}`; disabling removes it.
- [ ] Fixture project with `internalCost`, `adminNote`, hours/margins never appears in any projected doc.
- [ ] Unit: `tests/clientPortal-projectViews.test.ts` — zod `.strict()` rejects leaked fields.

## Rules

- [ ] Portal token cannot read `projects`, `tasks`, `notes`, `invoice_documents`, another client's `client_portal`, or internal messages.
- [ ] Approver can decide a pending approval once; viewer cannot (`isPortalApprover`).
- [ ] Workspace members cannot read another workspace's `portal_events`.
- [ ] `isWorkspaceMember` requires `request.auth.token.portal != true`.

## Auth

- [ ] Unknown email → friendly `not-invited` from `portalLoginPrecheck`.
- [ ] Invited email → magic link → `portalEnsureClaims` → Home renders.
- [ ] Revoked → sign-in refused; existing session loses access after token refresh (~1 min).

## Home / approvals / invoices

- [ ] Home shows pending approvals and projects.
- [ ] Accept checkpoint → milestone `acceptedByClientAt`, PM activity, CSAT when enabled.
- [ ] Invoice approve → status changes for finance.

## Requests / documents / Ask / weekly update

- [ ] Create from portal → ticket + activity; team reply visible; internal notes not projected.
- [ ] Only `clientFolder` attachments; signed URL expires (~10 min).
- [ ] Ask cites only projected content; costs with `costDetail` off → not available; logged to `portal_events`.
- [ ] Weekly update routine drafts; publish → UpdateView + activity + approvals + email; auto-publish only when allowed.

## Team tab / transition / phone / perf / i18n

- [ ] Preview as contact renders client view; toggles persist; invite/resend/revoke contacts.
- [ ] Old `/report|/status`, `/invoice`, `/request|/r`, `/c` links open and show portal banner.
- [ ] Phone bottom tabs usable at 390px.
- [ ] Portal lazy chunk separate from DelivereeWorkspace (build emits `PortalApp-*.js`; gzip ~8 KB in this run, budget &lt; 300 KB).
- [ ] Member locale switch flips portal strings and email template locale.
