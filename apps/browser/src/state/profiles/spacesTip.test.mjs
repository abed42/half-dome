import assert from "node:assert/strict";
import { test } from "node:test";
const { spacesTipDue } = await import("./spacesTip.ts");

test("the Spaces tip waits for onboarding, the switcher, and no tour", () => {
  assert.equal(spacesTipDue({ dismissed: false, onboardingDone: true, switcherShown: true, tourActive: false }), true);
  assert.equal(spacesTipDue({ dismissed: true, onboardingDone: true, switcherShown: true, tourActive: false }), false);
  assert.equal(spacesTipDue({ dismissed: false, onboardingDone: false, switcherShown: true, tourActive: false }), false);
  assert.equal(spacesTipDue({ dismissed: false, onboardingDone: true, switcherShown: false, tourActive: false }), false);
  assert.equal(spacesTipDue({ dismissed: false, onboardingDone: true, switcherShown: true, tourActive: true }), false);
});
