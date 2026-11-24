import assert from "node:assert/strict";
import { test } from "node:test";
const { useBrowser } = await import("../browser/store.ts");
const { loadSession, SESSION_VERSION } = await import("../session/persist.ts");
const { versionedJson } = await import("../../lib/savedDocument.ts");
const { savedDocumentValue } = await import("../session/documentJson.ts");
const { ADDRESS_BAR_DEFAULT_APPLIED: APPLIED } = await import("./addressBarDefault.ts");
const { DEFAULT_SETTINGS } = await import("./settings.ts");
const { settingsAdapter } = await import("../sync/settingsAdapter.ts");
const stub = await import("../../test-native/index.ts");

const S = () => useBrowser.getState();
const KEY = "addressBar";
const PROFILE = { id: "default", name: "Personal", color: "plum", icon: null, createdAt: 0 };
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
  return { place: S().settings[KEY], chosen: S().settingsMeta.chosen.includes(KEY), inferred: S().settingsMeta.inferred.includes(KEY) };
};
const pushed = () => settingsAdapter.extract(() => undefined).values.has(`set:${KEY}`);

test("a new install puts the address bar in the sidebar", () => {
  assert.equal(DEFAULT_SETTINGS[KEY], "sidebar");
  stub.docs.clear();
  S().hydrate({});
  assert.equal(S().settings[KEY], "sidebar");
});

test("a saved toolbar the user never touched moves to the sidebar and stays unchosen, so sync doesn't publish it", () => {
  const saved = { ...DEFAULT_SETTINGS, [KEY]: "toolbar", tabLayout: "top" };
  assert.deepEqual(load(doc(SESSION_VERSION, saved, { chosen: ["tabLayout"], inferred: [] })), { place: "sidebar", chosen: false, inferred: false });
  assert.equal(S().settings.tabLayout, "top");
  assert.equal(pushed(), false);
});

test("a toolbar from before choices were tracked (every key chosen and inferred) moves to the sidebar", () => {
  assert.deepEqual(load(doc(SESSION_VERSION, { ...DEFAULT_SETTINGS, [KEY]: "toolbar" }, { chosen: [KEY, "tabLayout"], inferred: [KEY, "tabLayout"] })), { place: "sidebar", chosen: false, inferred: false });
  assert.ok(S().settingsMeta.inferred.includes(APPLIED));
  assert.equal(load(doc(6, { ...DEFAULT_SETTINGS, [KEY]: "toolbar" })).place, "sidebar");
});

test("a toolbar the user chose stays on top and still syncs", () => {
  assert.deepEqual(load(doc(SESSION_VERSION, { ...DEFAULT_SETTINGS, [KEY]: "toolbar" }, { chosen: [KEY], inferred: [] })), { place: "toolbar", chosen: true, inferred: false });
  assert.equal(pushed(), true);
});

test("a sidebar the user chose stays on the left", () => {
  assert.deepEqual(load(doc(SESSION_VERSION, { ...DEFAULT_SETTINGS, [KEY]: "sidebar" }, { chosen: [KEY], inferred: [] })), { place: "sidebar", chosen: true, inferred: false });
});

const reload = () => {
  stub.docs.set("session.json", versionedJson(savedDocumentValue("session.json", S()), SESSION_VERSION));
  S().hydrate(loadSession());
  return S().settings[KEY];
};

test("the flip runs once per install: a toolbar that sync applies afterwards survives a relaunch with sync off", () => {
  load(doc(SESSION_VERSION, { ...DEFAULT_SETTINGS, [KEY]: "toolbar" }, { chosen: [], inferred: [] }));
  assert.equal(S().settings[KEY], "sidebar");
  assert.ok(S().settingsMeta.inferred.includes(APPLIED));
  settingsAdapter.apply(new Map([[`set:${KEY}`, { v: "toolbar" }]]), [`set:${KEY}`]);
  assert.equal(S().settingsMeta.chosen.includes(KEY), false);
  assert.equal(reload(), "toolbar");
  assert.equal(reload(), "toolbar");
});

test("the marker is kept across a rewrite that puts toolbar back, so a rollback and return doesn't flip again", () => {
  load(doc(SESSION_VERSION, { ...DEFAULT_SETTINGS, [KEY]: "sidebar" }, { chosen: [], inferred: [] }));
  const saved = JSON.parse(versionedJson(savedDocumentValue("session.json", S()), SESSION_VERSION));
  const rewritten = { ...saved, settings: { ...saved.settings, [KEY]: "toolbar" } };
  assert.ok(rewritten.settingsMeta.inferred.includes(APPLIED));
  assert.equal(load(rewritten).place, "toolbar");
});

test("a fresh install is marked too, so a later synced toolbar is never flipped", () => {
  stub.docs.clear();
  S().hydrate({});
  assert.ok(S().settingsMeta.inferred.includes(APPLIED));
});

test("a toolbar chosen on another Mac still applies here, since the unchosen local value never wins", () => {
  load(doc(SESSION_VERSION, { ...DEFAULT_SETTINGS, [KEY]: "toolbar" }, { chosen: [], inferred: [] }));
  settingsAdapter.apply(new Map([[`set:${KEY}`, { v: "toolbar" }]]), [`set:${KEY}`]);
  assert.equal(S().settings[KEY], "toolbar");
});
