import assert from "node:assert/strict";
import { test } from "node:test";

globalThis.__DEV__ = false;

const { useBrowser } = await import("../browser/store.ts");
const { switcherIconOf } = await import("./switcherMark.ts");
const { PROFILE_SYMBOLS, unusedProfileIcon } = await import("./profileSymbols.ts");
const { symbolIcon } = await import("../../lib/customIcon.ts");

const S = () => useBrowser.getState();

test("a newly created profile gets a distinct switcher icon, and an existing profile without one stays a dot", () => {
  S().hydrate({});
  S().updateSettings({ newTabOpens: "page", newTabPosition: "bottom" });
  assert.equal(switcherIconOf(S().profiles.default), null);
  const work = S().createProfile({ name: "Work", color: "blue" });
  const workIcon = switcherIconOf(S().profiles[work]);
  assert.equal(workIcon, symbolIcon(PROFILE_SYMBOLS[0].name));
  assert.notEqual(workIcon, null);
  const school = S().createProfile({ name: "School", color: "green" });
  assert.equal(switcherIconOf(S().profiles[school]), symbolIcon(PROFILE_SYMBOLS[1].name));
  assert.notEqual(switcherIconOf(S().profiles[school]), workIcon);
});

test("an explicit null icon stays a dot, so sync and import can still create one without a mark", () => {
  S().hydrate({});
  S().updateSettings({ newTabOpens: "page", newTabPosition: "bottom" });
  const id = S().createProfile({ name: "Plain", icon: null });
  assert.equal(S().profiles[id].icon, null);
  assert.equal(switcherIconOf(S().profiles[id]), null);
});

test("unusedProfileIcon skips icons already in use", () => {
  const used = { a: { icon: symbolIcon("house.fill") }, b: { icon: symbolIcon("briefcase.fill") } };
  assert.equal(unusedProfileIcon(used), symbolIcon("graduationcap.fill"));
});
