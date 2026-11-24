import assert from "node:assert/strict";
import { test } from "node:test";
const { useBrowser } = await import("../browser/store.ts");
const { loadSession, SESSION_VERSION } = await import("../session/persist.ts");
const { versionedJson } = await import("../../lib/savedDocument.ts");
const { savedDocumentValue } = await import("../session/documentJson.ts");
const {
  NEW_TAB_OPENS_DEFAULT_APPLIED,
  NEW_TAB_POSITION_DEFAULT_APPLIED,
  NEW_TAB_BUTTON_POSITION_DEFAULT_APPLIED,
  COMMAND_BAR_PLACEMENT_DEFAULT_APPLIED,
} = await import("./arcLayoutDefaults.ts");
const { DEFAULT_SETTINGS } = await import("./settings.ts");
const { settingsAdapter } = await import("../sync/settingsAdapter.ts");
const stub = await import("../../test-native/index.ts");

const S = () => useBrowser.getState();
const PROFILE = { id: "default", name: "Personal", color: "plum", icon: null, createdAt: 0 };
const FLIPS = [
  { key: "newTabOpens", oldDefault: "page", next: "commandBar", applied: NEW_TAB_OPENS_DEFAULT_APPLIED },
  { key: "newTabPosition", oldDefault: "bottom", next: "top", applied: NEW_TAB_POSITION_DEFAULT_APPLIED },
  { key: "newTabButtonPosition", oldDefault: "bottom", next: "top", applied: NEW_TAB_BUTTON_POSITION_DEFAULT_APPLIED },
  { key: "commandBarPlacement", oldDefault: "field", next: "centred", applied: COMMAND_BAR_PLACEMENT_DEFAULT_APPLIED },
];
const doc = (version, settings, settingsMeta) => ({
  version,
  profiles: { default: PROFILE },
  profileOrder: ["default"],
  settings,
  ...(settingsMeta ? { settingsMeta } : {}),
  windows: [],
  windowOrder: [],
  tabs: [],
  groups: [],
  splits: [],
  closedTabs: [],
  closedWindows: [],
});
const load = (saved) => {
  stub.docs.clear();
  stub.docs.set("session.json", JSON.stringify(saved));
  S().hydrate(loadSession());
};
const placeOf = (key) => ({ place: S().settings[key], chosen: S().settingsMeta.chosen.includes(key), inferred: S().settingsMeta.inferred.includes(key) });
const pushed = (key) => settingsAdapter.extract(() => undefined).values.has(`set:${key}`);
const reload = (key) => {
  stub.docs.set("session.json", versionedJson(savedDocumentValue("session.json", S()), SESSION_VERSION));
  S().hydrate(loadSession());
  return S().settings[key];
};

test("a new install uses Arc's new-tab and command-bar defaults", () => {
  for (const flip of FLIPS) assert.equal(DEFAULT_SETTINGS[flip.key], flip.next);
  stub.docs.clear();
  S().hydrate({});
  for (const flip of FLIPS) {
    assert.equal(S().settings[flip.key], flip.next);
    assert.ok(S().settingsMeta.inferred.includes(flip.applied));
  }
});

for (const flip of FLIPS) {
  test(`a saved ${flip.oldDefault} for ${flip.key} the user never touched moves to ${flip.next} and stays unchosen, so sync doesn't publish it`, () => {
    const saved = { ...DEFAULT_SETTINGS, [flip.key]: flip.oldDefault, tabLayout: "top" };
    load(doc(SESSION_VERSION, saved, { chosen: ["tabLayout"], inferred: [] }));
    assert.deepEqual(placeOf(flip.key), { place: flip.next, chosen: false, inferred: false });
    assert.equal(S().settings.tabLayout, "top");
    assert.equal(pushed(flip.key), false);
    assert.ok(S().settingsMeta.inferred.includes(flip.applied));
  });

  test(`a ${flip.oldDefault} for ${flip.key} from before choices were tracked moves to ${flip.next}`, () => {
    load(doc(SESSION_VERSION, { ...DEFAULT_SETTINGS, [flip.key]: flip.oldDefault }, { chosen: [flip.key, "tabLayout"], inferred: [flip.key, "tabLayout"] }));
    assert.deepEqual(placeOf(flip.key), { place: flip.next, chosen: false, inferred: false });
    assert.ok(S().settingsMeta.inferred.includes(flip.applied));
    load(doc(6, { ...DEFAULT_SETTINGS, [flip.key]: flip.oldDefault }));
    assert.equal(S().settings[flip.key], flip.next);
  });

  test(`a ${flip.oldDefault} for ${flip.key} the user chose stays and still syncs`, () => {
    load(doc(SESSION_VERSION, { ...DEFAULT_SETTINGS, [flip.key]: flip.oldDefault }, { chosen: [flip.key], inferred: [] }));
    assert.deepEqual(placeOf(flip.key), { place: flip.oldDefault, chosen: true, inferred: false });
    assert.equal(pushed(flip.key), true);
  });

  test(`a ${flip.next} for ${flip.key} the user chose stays`, () => {
    load(doc(SESSION_VERSION, { ...DEFAULT_SETTINGS, [flip.key]: flip.next }, { chosen: [flip.key], inferred: [] }));
    assert.deepEqual(placeOf(flip.key), { place: flip.next, chosen: true, inferred: false });
  });

  test(`the ${flip.key} flip runs once per install: an old value that sync applies afterwards survives a relaunch with sync off`, () => {
    load(doc(SESSION_VERSION, { ...DEFAULT_SETTINGS, [flip.key]: flip.oldDefault }, { chosen: [], inferred: [] }));
    assert.equal(S().settings[flip.key], flip.next);
    assert.ok(S().settingsMeta.inferred.includes(flip.applied));
    settingsAdapter.apply(new Map([[`set:${flip.key}`, { v: flip.oldDefault }]]), [`set:${flip.key}`]);
    assert.equal(S().settingsMeta.chosen.includes(flip.key), false);
    assert.equal(reload(flip.key), flip.oldDefault);
    assert.equal(reload(flip.key), flip.oldDefault);
  });

  test(`the ${flip.key} marker is kept across a rewrite that puts the old value back, so a rollback and return doesn't flip again`, () => {
    load(doc(SESSION_VERSION, { ...DEFAULT_SETTINGS, [flip.key]: flip.next }, { chosen: [], inferred: [] }));
    const saved = JSON.parse(versionedJson(savedDocumentValue("session.json", S()), SESSION_VERSION));
    const rewritten = { ...saved, settings: { ...saved.settings, [flip.key]: flip.oldDefault } };
    assert.ok(rewritten.settingsMeta.inferred.includes(flip.applied));
    load(rewritten);
    assert.equal(S().settings[flip.key], flip.oldDefault);
  });

  test(`a ${flip.oldDefault} for ${flip.key} chosen on another Mac still applies here, since the unchosen local value never wins`, () => {
    load(doc(SESSION_VERSION, { ...DEFAULT_SETTINGS, [flip.key]: flip.oldDefault }, { chosen: [], inferred: [] }));
    settingsAdapter.apply(new Map([[`set:${flip.key}`, { v: flip.oldDefault }]]), [`set:${flip.key}`]);
    assert.equal(S().settings[flip.key], flip.oldDefault);
  });
}

test("a saved newTabPosition of top still fills an absent newTabButtonPosition as top, and Arc's flip leaves both alone", () => {
  load(doc(7, { newTabPosition: "top", chosen: ["newTabPosition"], inferred: [] }));
  assert.equal(S().settings.newTabPosition, "top");
  assert.equal(S().settings.newTabButtonPosition, "top");
  assert.ok(S().settingsMeta.chosen.includes("newTabButtonPosition"));
});
