import assert from "node:assert/strict";
import { test } from "node:test";
const { SPACES_TIP_COPY, spacesTipCopy } = await import("./SpacesTip.tsx");

test("the tip's user-facing copy says Profiles and color", () => {
  assert.equal(SPACES_TIP_COPY.title, "Profiles in Half Dome");
  assert.match(SPACES_TIP_COPY.many, /theme color/);
  assert.doesNotMatch(SPACES_TIP_COPY.many, /colour|Space/);
  assert.doesNotMatch(SPACES_TIP_COPY.one, /colour|Space/);
  assert.doesNotMatch(SPACES_TIP_COPY.title, /Space/);
});

test("with one profile the tip teaches adding another through New Profile…", () => {
  const one = spacesTipCopy(1);
  assert.equal(one.action, "New Profile…");
  assert.match(one.body, /Add a second one/);
  const many = spacesTipCopy(2);
  assert.equal(many.action, "Got it");
  assert.match(many.body, /Right-click one below/);
});
