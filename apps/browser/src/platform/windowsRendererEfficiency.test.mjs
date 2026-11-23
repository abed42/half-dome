import assert from "node:assert/strict";
import { test } from "node:test";
import { rendererEfficiencyCounts } from "../../../../packages/expo-windows/src/engine/rendererEfficiency.ts";

const ZERO = { throttled: 0, restored: 0, failed: 0, exemptCall: 0, exemptCapture: 0, exemptPictureInPicture: 0, exemptAudio: 0 };

function engine() {
  const pending = [];
  let counts = { ...ZERO };
  const ask = () =>
    new Promise((resolve) => {
      const taken = counts;
      counts = { ...ZERO };
      pending.push(() => resolve({ counts: taken }));
    });
  const note = (key, n = 1) => void (counts[key] += n);
  const answerAll = async () => {
    while (pending.length) pending.shift()();
    await new Promise((resolve) => setImmediate(resolve));
  };
  return { ask, note, answerAll, pending };
}

test("counts are kept under the consent epoch they were asked in, and start again from zero once taken", async () => {
  const fake = engine();
  const counts = rendererEfficiencyCounts(fake.ask, () => true);
  try {
    counts.setConsentEpoch("e1");
    await fake.answerAll();
    fake.note("throttled", 3);
    fake.note("exemptCall");
    counts.refresh();
    await fake.answerAll();
    assert.deepEqual(counts.takeCounts(), { e1: { ...ZERO, throttled: 3, exemptCall: 1 } });
    await fake.answerAll();
    assert.deepEqual(counts.takeCounts(), {});
  } finally {
    counts.stop();
  }
});

test("counts from before sharing was turned on never come back after the boundary drained them", async () => {
  const fake = engine();
  const counts = rendererEfficiencyCounts(fake.ask, () => true);
  try {
    fake.note("exemptCall", 3);
    counts.takeCounts();
    assert.equal(fake.pending.length, 1);
    counts.setConsentEpoch("e1");
    assert.deepEqual(counts.takeCounts(), {});
    await fake.answerAll();
    fake.note("throttled");
    counts.refresh();
    await fake.answerAll();
    assert.deepEqual(counts.takeCounts(), { e1: { ...ZERO, throttled: 1 } });
  } finally {
    counts.stop();
  }
});

test("a new epoch asks the engine to drop what it counted before, and a reply from the old epoch is dropped", async () => {
  const fake = engine();
  const counts = rendererEfficiencyCounts(fake.ask, () => true);
  try {
    counts.setConsentEpoch("e1");
    await fake.answerAll();
    fake.note("restored", 2);
    counts.refresh();
    counts.setConsentEpoch("e2");
    await fake.answerAll();
    assert.deepEqual(counts.takeCounts(), {});
  } finally {
    counts.stop();
  }
});

test("without sharing (no epoch) nothing is kept", async () => {
  const fake = engine();
  const counts = rendererEfficiencyCounts(fake.ask, () => true);
  try {
    fake.note("throttled", 5);
    counts.refresh();
    await fake.answerAll();
    assert.deepEqual(counts.takeCounts(), {});
  } finally {
    counts.stop();
  }
});

test("anything but a whole positive number counts as nothing, and a bad or failed reply leaves zero", async () => {
  const hostile = { throttled: -5, restored: 1.5, failed: "7", exemptCall: Number.MAX_VALUE, exemptCapture: null, exemptPictureInPicture: { valueOf: () => 9 }, exemptAudio: 2, url: "https://example.com" };
  const counts = rendererEfficiencyCounts(async () => ({ counts: hostile }), () => true);
  try {
    counts.setConsentEpoch("e1");
    await new Promise((resolve) => setImmediate(resolve));
    await counts.refresh();
    const taken = counts.takeCounts();
    assert.deepEqual(taken, { e1: { ...ZERO, exemptAudio: 2 } });
    assert.equal("url" in taken.e1, false);
  } finally {
    counts.stop();
  }
  for (const ask of [async () => ({ counts: "lots" }), async () => ({}), async () => Promise.reject(new Error("unknown verb")), async () => null]) {
    const bad = rendererEfficiencyCounts(ask, () => true);
    try {
      bad.setConsentEpoch("e1");
      await bad.refresh();
      const taken = bad.takeCounts();
      assert.ok(!taken.e1 || Object.values(taken.e1).every((n) => n === 0));
    } finally {
      bad.stop();
    }
  }
});

test("every request names the epoch it counts for, so the engine can drop what it counted before", async () => {
  const asked = [];
  const counts = rendererEfficiencyCounts(async (epoch) => (asked.push(epoch), { counts: {} }), () => true);
  try {
    counts.setConsentEpoch("e1");
    await counts.refresh();
    counts.setConsentEpoch("e2");
    await counts.refresh();
    counts.setConsentEpoch("");
    assert.deepEqual(asked, ["e1", "e1", "e2", "e2", ""]);
  } finally {
    counts.stop();
  }
});

test("without an engine it never asks", async () => {
  let asked = 0;
  const counts = rendererEfficiencyCounts(async () => (asked++, { counts: { throttled: 1 } }), () => false);
  counts.setConsentEpoch("e1");
  await counts.refresh();
  assert.deepEqual(counts.takeCounts(), {});
  assert.equal(asked, 0);
  counts.stop();
});
