import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ITEM_MODAL_FIELD_MAP, REQUIRED_FIELD_KEYS } from "../src/features/items/ItemModal/fieldMap";
import { isItemModalV2Enabled } from "../src/features/items/ItemModal/itemModalFlag";

test("item modal field map covers discovery fields", () => {
  for (const key of [
    "workItemType",
    "title",
    "description",
    "status",
    "priority",
    "assignee",
    "collaborators",
    "startDate",
    "dueDate",
    "sprintId",
    "estimateHours",
    "tags",
    "parent",
    "deliveryEntity",
    "clientEntity",
    "workCategory",
    "productPhase",
    "projectId",
    "storyPoints",
    "loggedHours",
    "recurrence",
    "gtdType",
    "actionBoardBucket",
    "checklist",
    "comments",
  ]) {
    assert.ok(REQUIRED_FIELD_KEYS.includes(key), `missing ${key}`);
  }
  assert.ok(ITEM_MODAL_FIELD_MAP.every((entry) => entry.group));
});

test("item modal v2 is behind a Vite flag with safe defaults", () => {
  const flag = readFileSync(resolve("src/features/items/ItemModal/itemModalFlag.ts"), "utf8");
  const env = readFileSync(resolve(".env.example"), "utf8");
  assert.match(flag, /VITE_ITEM_MODAL_V2/);
  assert.match(env, /VITE_ITEM_MODAL_V2=0/);
  assert.equal(typeof isItemModalV2Enabled(), "boolean");
});

test("WorkItemsCenter keeps legacy modal when flag is off", () => {
  const source = readFileSync(resolve("src/components/WorkItemsCenter.tsx"), "utf8");
  assert.match(source, /isItemModalV2Enabled/);
  assert.match(source, /data-testid="item-modal-v2"|ItemModal/);
  assert.match(source, /!isItemModalV2Enabled\(\)/);
  assert.match(source, /data-testid="item-expanded-modal"/);
});

test("ItemModal uses DestructiveDialog and existing save props", () => {
  const source = readFileSync(
    resolve("src/features/items/ItemModal/ItemModal.tsx"),
    "utf8",
  );
  assert.match(source, /DestructiveDialog/);
  assert.match(source, /onUpdateTask/);
  assert.match(source, /dueDateTimingPatch/);
  assert.match(source, /CompactTagPicker/);
  assert.match(source, /MultiAssigneePicker/);
  assert.doesNotMatch(source, /window\.confirm/);
});
