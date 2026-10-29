// Tests for the dashboard's headline numbers (src/lib/home/stats.mjs).
//
// Run:  node --test tests/lib/home-stats.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import "../helpers/web-ts-alias-loader.mjs";

const { greeting, homeStats } = await import("../../src/lib/home/stats.mjs");

test("homeStats counts each stage through the canonical status mapping", () => {
  const rows = ["Evaluated", "Evaluada", "Applied", "Responded", "Interview", "Interview", "Offer", "Hired", "Rejected", "Discarded", "SKIP", ""].map((status) => ({ status }));
  assert.deepEqual(homeStats(rows), { active: 4, interviews: 2, offers: 2, evaluated: 2, applied: 7, responded: 5 });
});

test("homeStats on an empty tracker is all zeros", () => {
  assert.deepEqual(homeStats([]), { active: 0, interviews: 0, offers: 0, evaluated: 0, applied: 0, responded: 0 });
});

test("greeting follows the local hour", () => {
  assert.equal(greeting(6), "Good morning");
  assert.equal(greeting(13), "Good afternoon");
  assert.equal(greeting(21), "Good evening");
});
