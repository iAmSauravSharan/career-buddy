// Tests for the onboarding stepper's pure half (src/lib/onboarding.mjs):
// validating the form, the answers handed to onboard-write.mjs on a first run,
// and the merge into files that already exist, which must keep everything the
// form does not own (archetypes, narrative, tracked companies, hand-written
// location rules).
//
// Run:  node --test tests/lib/onboarding.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deepMerge,
  emptyForm,
  formFromFiles,
  mergeOnboardingPortals,
  OnboardingError,
  parseForm,
  toCoreAnswers,
  toProfilePatch,
} from "../../src/lib/onboarding.mjs";

function filled(overrides = {}) {
  const f = emptyForm();
  f.candidate.full_name = "Ada Lovelace";
  f.candidate.email = "ada@example.org";
  f.location.city = "London";
  f.location.country = "United Kingdom";
  f.location.timezone = "Europe/London";
  f.target_roles = ["Staff Engineer", " Staff Engineer ", "Engineering Manager"];
  f.compensation.target_range = "£120K-150K";
  f.compensation.currency = "gbp";
  f.search.countries = ["United Kingdom"];
  f.search.cities = ["Berlin"];
  return { ...f, ...overrides };
}

test("parseForm trims, dedupes roles and upper-cases the currency", () => {
  const form = parseForm(filled());
  assert.deepEqual(form.target_roles, ["Staff Engineer", "Engineering Manager"]);
  assert.equal(form.compensation.currency, "GBP");
  assert.equal(form.spend_tier, "standard");
});

test("parseForm names the missing field", () => {
  const cases = [
    [{ candidate: { ...filled().candidate, full_name: " " } }, "candidate.full_name"],
    [{ candidate: { ...filled().candidate, email: "not-an-email" } }, "candidate.email"],
    [{ target_roles: [] }, "target_roles"],
    [{ location: { ...filled().location, timezone: "" } }, "location.timezone"],
    [{ compensation: { ...filled().compensation, target_range: "" } }, "compensation.target_range"],
    [{ spend_tier: "luxury" }, "spend_tier"],
  ];
  for (const [patch, field] of cases) {
    assert.throws(() => parseForm(filled(patch)), (e) => e instanceof OnboardingError && e.field === field, field);
  }
});

test("parseForm refuses a work style typed as a place", () => {
  assert.throws(
    () => parseForm(filled({ search: { countries: ["Remote"], cities: [] } })),
    (e) => e instanceof OnboardingError && e.field === "search",
  );
});

test("toCoreAnswers matches the onboard-write.mjs answers shape", () => {
  const a = toCoreAnswers(parseForm(filled()));
  assert.equal(a.candidate.location, "London, United Kingdom");
  assert.deepEqual(a.target_roles, ["Staff Engineer", "Engineering Manager"]);
  assert.deepEqual(a.portals.positive, a.target_roles);
  assert.deepEqual(a.portals.countries, ["United Kingdom"]);
  assert.deepEqual(a.portals.cities, ["Berlin"]);
});

test("the profile merge keeps archetypes and narrative", () => {
  const existing = {
    candidate: { full_name: "Old", github: "github.com/ada" },
    target_roles: { primary: ["Old role"], archetypes: [{ name: "Backend", level: "Senior", fit: "primary" }] },
    narrative: { headline: "Mine" },
    cv: { output_format: "latex" },
  };
  const merged = deepMerge(existing, toProfilePatch(parseForm(filled())));
  assert.equal(merged.candidate.full_name, "Ada Lovelace");
  assert.equal(merged.candidate.github, "github.com/ada");
  assert.deepEqual(merged.target_roles.primary, ["Staff Engineer", "Engineering Manager"]);
  assert.equal(merged.target_roles.archetypes.length, 1);
  assert.equal(merged.narrative.headline, "Mine");
  assert.equal(merged.cv.output_format, "latex");
});

test("the portals merge replaces the form's filters and keeps tracked companies", () => {
  const doc = {
    title_filter: { positive: ["old"], negative: ["Intern"] },
    location_filter: { deny: ["Antarctica"], allow: ["Old"] },
    tracked_companies: [{ name: "Acme" }],
  };
  const out = mergeOnboardingPortals(doc, parseForm(filled()));
  assert.deepEqual(out.title_filter, { positive: ["Staff Engineer", "Engineering Manager"], negative: ["Intern"] });
  assert.deepEqual(out.location_filter, { deny: ["Antarctica"], always_allow: ["United Kingdom"], allow: ["United Kingdom", "Berlin"] });
  assert.deepEqual(out.tracked_companies, [{ name: "Acme" }]);
});

test("no places leaves an existing location_filter alone", () => {
  const doc = { title_filter: {}, location_filter: { allow: ["Hand written"] } };
  const out = mergeOnboardingPortals(doc, parseForm(filled({ search: { countries: [], cities: [] } })));
  assert.deepEqual(out.location_filter, { allow: ["Hand written"] });
});

test("formFromFiles round-trips what the merge wrote", () => {
  const form = parseForm(filled());
  const profile = deepMerge({}, toProfilePatch(form));
  const portals = mergeOnboardingPortals({}, form);
  const back = formFromFiles(profile, portals);
  assert.deepEqual(back.target_roles, form.target_roles);
  assert.deepEqual(back.search, form.search);
  assert.equal(back.candidate.email, form.candidate.email);
  assert.equal(back.compensation.currency, "GBP");
});

test("formFromFiles with no files is the empty form", () => {
  assert.deepEqual(formFromFiles(null, null), emptyForm());
});
