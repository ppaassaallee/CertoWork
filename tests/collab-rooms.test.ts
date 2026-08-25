import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  collabItemMatches,
  partitionCollabDesk,
  sortCollabItemsByRecent,
} from "../src/lib/collabRooms";

const atlas = {
  id: "p1",
  name: "Atlas",
  kind: "project" as const,
  projectId: "p1",
  lastActivityAt: 2000,
};
const river = {
  id: "p2",
  name: "River",
  kind: "project" as const,
  projectId: "p2",
  lastActivityAt: 4000,
};
const website = {
  id: "c1",
  name: "Website widget",
  kind: "channel" as const,
  lastActivityAt: 3000,
};

test("desk items sort by recent interaction, then name", () => {
  assert.deepEqual(
    sortCollabItemsByRecent([atlas, river, website]).map((item) => item.id),
    ["p2", "c1", "p1"],
  );
});

test("project rooms stay separate from other channels and can be searched", () => {
  const desk = partitionCollabDesk([atlas, river, website], "riv");
  assert.deepEqual(
    desk.projectRooms.map((item) => item.id),
    ["p2"],
  );
  assert.deepEqual(desk.otherChannels, []);
  const all = partitionCollabDesk([atlas, river, website], "");
  assert.deepEqual(
    all.projectRooms.map((item) => item.id),
    ["p2", "p1"],
  );
  assert.deepEqual(
    all.otherChannels.map((item) => item.id),
    ["c1"],
  );
  assert.equal(collabItemMatches(atlas, "atl"), true);
});

test("Chat Collab exposes a searchable project-room section next to other channels", () => {
  const collab = readFileSync(resolve("src/components/ChatCollabModule.tsx"), "utf8");
  const css = readFileSync(resolve("src/index.css"), "utf8");
  assert.match(collab, /data-testid="collab-room-search"/);
  assert.match(collab, /Project rooms/);
  assert.match(collab, /Other channels/);
  assert.match(collab, /partitionCollabDesk/);
  assert.match(css, /do-collab-nav-scroll/);
  assert.match(css, /do-collab-stage/);
  assert.match(css, /overflow-y: auto/);
});
