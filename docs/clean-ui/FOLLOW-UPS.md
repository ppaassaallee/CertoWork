# Clean UI — Follow-ups

Visual changes that seemed to need logic changes (deferred out of Track A):

| Item | Why deferred |
|------|----------------|
| Move Create into top-bar overflow | Header Create keeps existing handler; overflow grouping is CSS/layout only unless handlers move |
| Rail always-on (not gated by billing/brief flags) | Flag gate is logic in DelivereeWorkspace — do not change in Track A |
| Live Playwright screenshots | No Playwright dep; static parity used |
| Lighthouse ≥ 95 | Requires headed run + deploy URL; report in A7 with local fallback notes |
