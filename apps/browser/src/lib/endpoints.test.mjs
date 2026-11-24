import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

globalThis.__DEV__ = false;
const stub = await import("../test-native/index.ts");
Object.assign(stub.appInfo, { appVersion: "0.3.0", osVersion: "26.1", arch: "arm64", isolatedInstance: false });

const endpoints = await import("./endpoints.ts");
const { mayPost, post } = await import("../state/telemetry/transport.ts");
const daily = await import("../state/telemetry/daily.ts");
const ks = await import("../platform/killSwitches.ts");
const { sendCurrentReport } = await import("../state/report/actions.ts");
const { patchDraft, patchReport, currentReport } = await import("../state/report/store.ts");

const asked = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  asked.push({ url: String(url), init });
  return { ok: true, status: 200, text: async () => JSON.stringify({ version: 1, switches: {} }) };
};

after(() => {
  globalThis.fetch = originalFetch;
  endpoints.resetServiceEndpointsForTests();
  ks.resetRefreshForTests();
  ks.reloadSwitches();
});

const reset = () => {
  asked.length = 0;
  endpoints.resetServiceEndpointsForTests();
  stub.docs.clear();
  daily.resetDailyForTests(false);
  ks.resetRefreshForTests();
  ks.reloadSwitches();
  patchReport({ windowId: null, upload: { phase: "idle" }, sent: null });
};

test("defaults leave every Half Dome service endpoint empty", () => {
  reset();
  assert.equal(endpoints.LOGS_URL, "");
  assert.equal(endpoints.FEEDBACK_URL, "");
  assert.equal(endpoints.SWITCHES_URL, "");
  assert.equal(endpoints.logsReady(), false);
  assert.equal(endpoints.feedbackReady(), false);
  assert.equal(endpoints.switchesReady(), false);
});

test("with the defaults nothing is posted to ardia.dev or an ardia-browser host", async () => {
  reset();
  assert.equal(mayPost("daily"), false);
  assert.equal(mayPost("events"), false);
  assert.equal(await post("daily", "{}", 1), 200);
  assert.equal(await post("events", "{}", 1), 200);
  assert.equal(await daily.sendDailyPing(Date.parse("2026-10-25T12:00:00Z")), "sent");
  assert.equal(await ks.refreshSwitches(), "failed");
  patchDraft({ title: "Tabs vanish", description: "After a restart they are gone." });
  patchReport({ windowId: "w1" });
  await sendCurrentReport();
  assert.equal(currentReport().upload.phase, "failed");
  assert.equal(asked.length, 0);
  for (const call of asked) assert.equal(endpoints.isArdiaServiceUrl(call.url), false);
});

test("a configured logs URL posts only there, never to an Ardia host", async () => {
  reset();
  const logs = "https://telemetry.example.test/otel/v1/logs";
  endpoints.setServiceEndpointsForTests({ logs });
  assert.equal(mayPost("daily"), true);
  assert.equal(await post("daily", "{}", 1), 200);
  assert.equal(asked.length, 1);
  assert.equal(asked[0].url, logs);
  assert.equal(endpoints.isArdiaServiceUrl(asked[0].url), false);
});

test("a configured switches URL is fetched once; empty skips the network", async () => {
  reset();
  assert.equal(await ks.refreshSwitches(), "failed");
  assert.equal(asked.length, 0);
  ks.resetRefreshForTests();
  endpoints.setServiceEndpointsForTests({ switches: "https://switches.example.test/switches.json" });
  assert.equal(await ks.refreshSwitches(), "updated");
  assert.equal(asked.length, 1);
  assert.equal(asked[0].url, "https://switches.example.test/switches.json");
  assert.equal(endpoints.isArdiaServiceUrl(asked[0].url), false);
});

test("the Mac Info.plist keeps feedback and release-notes empty and carries no Sparkle feed or key", () => {
  const plist = readFileSync(fileURLToPath(new URL("../../macos/Ardia-macOS/Info.plist", import.meta.url)), "utf8");
  assert.match(plist, /<key>ACFeedbackURL<\/key>\s*<string><\/string>/);
  assert.match(plist, /<key>ACReleaseNotesURL<\/key>\s*<string><\/string>/);
  assert.doesNotMatch(plist, /SUFeedURL/);
  assert.doesNotMatch(plist, /SUPublicEDKey/);
  assert.doesNotMatch(plist, /ardia\.dev/);
  assert.doesNotMatch(plist, /ardia-browser/);
});

test("isArdiaServiceUrl names Ardia's site and GitHub org", () => {
  assert.equal(endpoints.isArdiaServiceUrl("https://ardia.dev/otel/v1/logs"), true);
  assert.equal(endpoints.isArdiaServiceUrl("https://www.ardia.dev/x"), true);
  assert.equal(endpoints.isArdiaServiceUrl("https://github.com/ardia-browser/ardia/releases/latest/download/appcast.xml"), true);
  assert.equal(endpoints.isArdiaServiceUrl("https://telemetry.example.test/otel/v1/logs"), false);
  assert.equal(endpoints.isArdiaServiceUrl("https://github.com/abed42/half-dome/releases/latest/download/appcast.xml"), false);
});
