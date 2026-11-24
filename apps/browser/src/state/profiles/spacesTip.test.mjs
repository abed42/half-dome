import assert from "node:assert/strict";
import { test } from "node:test";
const { dismissSpacesTip, forgetSpacesTipForTests, markSpacesTipShown, spacesTipDue, useSpacesTip } = await import("./spacesTip.ts");

test("the Profiles tip waits for onboarding and no tour, including with one profile", () => {
  assert.equal(spacesTipDue({ dismissed: false, onboardingDone: true, tourActive: false }), true);
  assert.equal(spacesTipDue({ dismissed: true, onboardingDone: true, tourActive: false }), false);
  assert.equal(spacesTipDue({ dismissed: false, onboardingDone: false, tourActive: false }), false);
  assert.equal(spacesTipDue({ dismissed: false, onboardingDone: true, tourActive: true }), false);
});

test("a right-click dismisses and counts the tip only after it has been shown", () => {
  forgetSpacesTipForTests();
  dismissSpacesTip("menu", null);
  assert.equal(useSpacesTip.getState().dismissedAt, null);
  assert.equal(useSpacesTip.getState().shown, false);
  markSpacesTipShown(null);
  assert.equal(useSpacesTip.getState().shown, true);
  dismissSpacesTip("menu", null);
  assert.notEqual(useSpacesTip.getState().dismissedAt, null);
  forgetSpacesTipForTests();
});

test("Got it dismisses even when the tip has not marked itself shown yet", () => {
  forgetSpacesTipForTests();
  dismissSpacesTip("gotIt", null);
  assert.notEqual(useSpacesTip.getState().dismissedAt, null);
  forgetSpacesTipForTests();
});
