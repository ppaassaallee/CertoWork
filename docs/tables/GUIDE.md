# Tables Guide

## Column types
text, longText, number (plain/currency/percent), status, dropdown, people, date, timeline, checkbox, email, phone, url, files, link (two-way), lookup, rollup, formula (expr-eval), ai, createdAt, updatedAt, createdBy, autoNumber, button.

## Formula functions
IF, AND, OR, NOT, ROUND, SUM, MIN, MAX, CONCAT, LEN, LEFT, RIGHT, TODAY, DAYS, ADD_DAYS, MONTH, YEAR, TEXT. Reference columns as `{Column Name}`.

## Filter ops
is, is_not, contains, empty, not_empty, gt, lt, between, within_days, before, after, has_any, has_all.

## Triggers
record.created, record.changed, record.moved, date.reached, schedule, form.submitted, button.

## Actions
set, moveToGroup, createRecord, forEachRecord, createItem, createInvoice, notify, email, odysseus (LLM only), webhook.

## Template format
See `src/lib/tables/templates/systemTemplates.ts`. `provisionTemplate` remaps ids.

## Limits
See `src/lib/tables/limits.ts` — client filter &lt; 5k; AI 500/table/day; import 50k chunked 400; forms 60/min/IP; trash 30 days.
