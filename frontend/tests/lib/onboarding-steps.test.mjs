// Tests for the onboarding stepper's per-step checks (src/lib/onboarding-steps.mjs).
// The backend validates the whole form again on save; these make sure a missing
// field stops its own step and that a server error opens the step it belongs to.
//
// Run:  node --test tests/lib/onboarding-steps.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { addChip, STEPS, stepErrors, stepOfField } from "../../src/lib/onboarding-steps.mjs";

const blank = () => ({
  candidate: { full_name: "", email: "", phone: "", linkedin: "", portfolio_url: "" },
  location: { city: "", country: "", timezone: "", needs_sponsorship: false, authorized_in: [] },
  target_roles: [],
  work_style: "",
  compensation: { currency: "USD", target_range: "", minimum: "" },
  spend_tier: "standard",
  search: { countries: [], cities: [] },
});

test("details needs a name, a valid email, a country and a timezone", () => {
  assert.deepEqual(Object.keys(stepErrors("details", blank())).sort(), [
    "candidate.email", "candidate.full_name", "location.country", "location.timezone",
  ]);
  const f = blank();
  Object.assign(f.candidate, { full_name: "Ada", email: "ada@x" });
  Object.assign(f.location, { country: "UK", timezone: "Europe/London" });
  assert.equal(stepErrors("details", f)["candidate.email"], "That doesn't look like an email address");
  f.candidate.email = "ada@example.org";
  assert.deepEqual(stepErrors("details", f), {});
});

test("roles and pay have required fields; AI and review never block", () => {
  assert.ok(stepErrors("roles", blank()).target_roles);
  assert.ok(stepErrors("pay", blank())["compensation.target_range"]);
  assert.deepEqual(stepErrors("ai", blank()), {});
  assert.deepEqual(stepErrors("review", blank()), {});
});

test("a work style typed as a place is caught on the location step", () => {
  const f = blank();
  f.search.countries = ["Remote"];
  assert.match(stepErrors("location", f).search, /work style/);
});

test("every server field maps to a real step", () => {
  const ids = new Set(STEPS.map((s) => s.id));
  for (const field of ["candidate.email", "location.timezone", "target_roles", "search", "compensation.currency", "spend_tier", undefined]) {
    assert.ok(ids.has(stepOfField(field)), String(field));
  }
  assert.equal(stepOfField("location.timezone"), "details");
  assert.equal(stepOfField("search"), "location");
});

test("addChip trims, drops a trailing comma and ignores duplicates", () => {
  assert.deepEqual(addChip([], "  Staff Engineer, "), ["Staff Engineer"]);
  assert.deepEqual(addChip(["Staff Engineer"], "staff engineer"), ["Staff Engineer"]);
  assert.deepEqual(addChip(["a"], "   "), ["a"]);
  assert.deepEqual(addChip(["a", "b"], "c", 2), ["a", "b"]);
});
