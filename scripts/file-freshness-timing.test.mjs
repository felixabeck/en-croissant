import assert from "node:assert/strict";
import { test } from "node:test";
import {
  fileFreshnessApplicationWithinBudget,
  fileFreshnessMainThreadWithinBudget,
  fileFreshnessTiming,
} from "./file-freshness-timing.mjs";

const measurement = {
  readFinishedAt: 100,
  appliedAt: 550,
  observedAt: 1600,
  lexAwaitMs: 300,
  readTimeMs: 50,
};

test("splits page timestamps and preserves the one-poll deadline width", () => {
  const timing = fileFreshnessTiming(measurement, 2000);
  assert.deepEqual(timing, {
    applicationMs: 150,
    observationGapMs: 1050,
    mainThreadMs: 1200,
    deadlineMs: 3550,
  });
  assert.equal(timing.mainThreadMs, timing.applicationMs + timing.observationGapMs);
  assert.equal(
    timing.deadlineMs,
    2000 + measurement.readTimeMs + measurement.observedAt - measurement.readFinishedAt,
  );
  // A slow commit fails the main-thread check even when the store application is fast.
  assert.equal(fileFreshnessApplicationWithinBudget(timing, 1000), true);
  assert.equal(fileFreshnessMainThreadWithinBudget(timing, 1000), false);
});

test("compares the actual main-thread duration against both budget boundaries", () => {
  for (const [mainThreadMs, expected] of [
    [-1, false],
    [0, true],
    [999, true],
    [1000, true],
    [1001, false],
  ]) {
    const timing = fileFreshnessTiming(
      {
        ...measurement,
        observedAt: measurement.readFinishedAt + measurement.lexAwaitMs + mainThreadMs,
      },
      2000,
    );
    assert.equal(
      fileFreshnessMainThreadWithinBudget(timing, 1000),
      expected,
      `mainThreadMs=${mainThreadMs}`,
    );
  }
});

test("missing or non-finite main-thread stamps and lex durations fail the main-thread check", () => {
  for (const key of ["readFinishedAt", "observedAt", "lexAwaitMs"]) {
    for (const value of [null, undefined, Number.NaN, Infinity, -Infinity]) {
      const timing = fileFreshnessTiming({ ...measurement, [key]: value }, 2000);
      assert.equal(fileFreshnessMainThreadWithinBudget(timing, 1000), false, `${key}=${value}`);
    }
  }
});

test("compares the actual application duration against both budget boundaries", () => {
  for (const [applicationMs, expected] of [
    [-1, false],
    [0, true],
    [999, true],
    [1000, true],
    [1001, false],
  ]) {
    const timing = fileFreshnessTiming(
      {
        ...measurement,
        appliedAt: measurement.readFinishedAt + measurement.lexAwaitMs + applicationMs,
      },
      2000,
    );
    assert.equal(
      fileFreshnessApplicationWithinBudget(timing, 1000),
      expected,
      `applicationMs=${applicationMs}`,
    );
  }
});

test("missing or non-finite application stamps and lex durations fail the application check", () => {
  for (const key of ["readFinishedAt", "appliedAt", "lexAwaitMs"]) {
    for (const value of [null, undefined, Number.NaN, Infinity, -Infinity]) {
      const timing = fileFreshnessTiming({ ...measurement, [key]: value }, 2000);
      assert.equal(fileFreshnessApplicationWithinBudget(timing, 1000), false, `${key}=${value}`);
    }
  }
});

test("unmeasured observation or native read cannot produce a one-poll deadline", () => {
  for (const key of ["observedAt", "readTimeMs"]) {
    const timing = fileFreshnessTiming({ ...measurement, [key]: null }, 2000);
    assert.equal(Number.isNaN(timing.deadlineMs), true);
  }
});
