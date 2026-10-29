// The onboarding stepper's data, both ways: what the form shows (read out of
// config/profile.yml and portals.yml) and what a finished form writes.
//
// A first run hands the answers to the root onboard-write.mjs, which builds
// both files from their templates and blanks the example person's contact
// details. That script never touches a file that already exists, so a user who
// re-runs the stepper gets a merge instead: only the fields the form owns are
// replaced, and archetypes, narrative, tracked companies and everything else
// stay as they were. This module holds the pure half of both paths.

/** @typedef {{
 *   candidate: { full_name: string, email: string, phone: string, linkedin: string, portfolio_url: string },
 *   location: { city: string, country: string, timezone: string, needs_sponsorship: boolean, authorized_in: string[] },
 *   target_roles: string[],
 *   work_style: string,
 *   compensation: { currency: string, target_range: string, minimum: string },
 *   spend_tier: "economy" | "standard" | "premium",
 *   search: { countries: string[], cities: string[] },
 * }} OnboardingForm */

const TIERS = ["economy", "standard", "premium"];
const CONTACT = ["phone", "linkedin", "portfolio_url"];
// Same rule as onboard-write.mjs: an allow-list entry like these admits every country.
const NOT_A_PLACE = /^(remote|hybrid|anywhere|on-?site)$/i;
const MAX_ROLES = 12;
const MAX_PLACES = 24;

const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v) => (typeof v === "string" ? v.trim() : "");
const strList = (v, max) =>
  [...new Set((Array.isArray(v) ? v : []).map(str).filter(Boolean))].slice(0, max);

export class OnboardingError extends Error {
  /** @param {string} message @param {string} [field] */
  constructor(message, field) {
    super(message);
    this.field = field;
  }
}

/** An empty form: what a user with no profile yet starts from. */
export function emptyForm() {
  return {
    candidate: { full_name: "", email: "", phone: "", linkedin: "", portfolio_url: "" },
    location: { city: "", country: "", timezone: "", needs_sponsorship: false, authorized_in: [] },
    target_roles: [],
    work_style: "",
    compensation: { currency: "USD", target_range: "", minimum: "" },
    spend_tier: "standard",
    search: { countries: [], cities: [] },
  };
}

/**
 * Validate an untrusted form body. Throws OnboardingError naming the field.
 * @param {unknown} raw
 * @returns {OnboardingForm}
 */
export function parseForm(raw) {
  if (!isObj(raw)) throw new OnboardingError("the form must be an object");
  const c = isObj(raw.candidate) ? raw.candidate : {};
  const l = isObj(raw.location) ? raw.location : {};
  const comp = isObj(raw.compensation) ? raw.compensation : {};
  const search = isObj(raw.search) ? raw.search : {};

  const need = (value, field, label) => {
    if (!value) throw new OnboardingError(`${label} is required`, field);
    return value;
  };
  const email = need(str(c.email), "candidate.email", "Email");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new OnboardingError("Email doesn't look like an address", "candidate.email");

  const roles = strList(raw.target_roles, MAX_ROLES);
  if (!roles.length) throw new OnboardingError("Add at least one target role", "target_roles");

  const countries = strList(search.countries, MAX_PLACES);
  const cities = strList(search.cities, MAX_PLACES);
  const notPlace = [...countries, ...cities].find((p) => NOT_A_PLACE.test(p));
  if (notPlace) {
    throw new OnboardingError(`"${notPlace}" is a work style, not a place. Pick it under work style instead.`, "search");
  }

  const tier = raw.spend_tier ?? "standard";
  if (!TIERS.includes(tier)) throw new OnboardingError("Pick economy, standard or premium", "spend_tier");

  return {
    candidate: {
      full_name: need(str(c.full_name), "candidate.full_name", "Full name"),
      email,
      ...Object.fromEntries(CONTACT.map((k) => [k, str(c[k])])),
    },
    location: {
      city: str(l.city),
      country: need(str(l.country), "location.country", "Country"),
      timezone: need(str(l.timezone), "location.timezone", "Timezone"),
      needs_sponsorship: l.needs_sponsorship === true,
      authorized_in: strList(l.authorized_in, MAX_PLACES),
    },
    target_roles: roles,
    work_style: str(raw.work_style),
    compensation: {
      currency: need(str(comp.currency).toUpperCase(), "compensation.currency", "Currency"),
      target_range: need(str(comp.target_range), "compensation.target_range", "Target range"),
      minimum: str(comp.minimum),
    },
    spend_tier: tier,
    search: { countries, cities },
  };
}

/** "City, Country", or the country alone. */
export function displayLocation(form) {
  return [form.location.city, form.location.country].filter(Boolean).join(", ");
}

/**
 * The answers onboard-write.mjs takes for a first run. Title keywords default
 * to the target roles, the same default the agent onboarding uses.
 * @param {OnboardingForm} form
 */
export function toCoreAnswers(form) {
  return {
    candidate: { ...form.candidate, location: displayLocation(form) },
    target_roles: form.target_roles,
    compensation: {
      target_range: form.compensation.target_range,
      currency: form.compensation.currency,
      minimum: form.compensation.minimum,
      location_flexibility: form.work_style,
    },
    location: {
      country: form.location.country,
      city: form.location.city,
      timezone: form.location.timezone,
      authorized_in: form.location.authorized_in,
      needs_sponsorship: form.location.needs_sponsorship,
    },
    spend_tier: form.spend_tier,
    portals: {
      positive: form.target_roles,
      countries: form.search.countries,
      cities: form.search.cities,
    },
  };
}

/**
 * The part of profile.yml the form owns, as a patch to deep-merge onto an
 * existing profile. target_roles.primary replaces the list; archetypes beside
 * it are kept by the merge.
 * @param {OnboardingForm} form
 */
export function toProfilePatch(form) {
  return {
    candidate: { ...form.candidate, location: displayLocation(form) },
    target_roles: { primary: form.target_roles },
    compensation: {
      target_range: form.compensation.target_range,
      currency: form.compensation.currency,
      minimum: form.compensation.minimum,
      location_flexibility: form.work_style,
    },
    location: {
      country: form.location.country,
      city: form.location.city,
      timezone: form.location.timezone,
      authorized_in: form.location.authorized_in,
      needs_sponsorship: form.location.needs_sponsorship,
    },
    spend_tier: form.spend_tier,
  };
}

/** Deep-merge src onto dst (objects recurse; arrays and scalars replace). Non-mutating. */
export function deepMerge(dst, src) {
  const out = isObj(dst) ? { ...dst } : {};
  for (const [k, v] of Object.entries(src)) out[k] = isObj(v) ? deepMerge(out[k], v) : v;
  return out;
}

/**
 * Prefill the form from the parsed files. Either may be null (not created yet).
 * @param {Record<string, any> | null} profile
 * @param {Record<string, any> | null} portals
 * @returns {OnboardingForm}
 */
export function formFromFiles(profile, portals) {
  const form = emptyForm();
  if (isObj(profile)) {
    const c = isObj(profile.candidate) ? profile.candidate : {};
    for (const k of Object.keys(form.candidate)) form.candidate[k] = str(c[k]);
    const l = isObj(profile.location) ? profile.location : {};
    form.location = {
      city: str(l.city),
      country: str(l.country),
      timezone: str(l.timezone),
      needs_sponsorship: l.needs_sponsorship === true,
      authorized_in: strList(l.authorized_in, MAX_PLACES),
    };
    const roles = isObj(profile.target_roles) ? profile.target_roles.primary : undefined;
    form.target_roles = strList(roles, MAX_ROLES);
    const comp = isObj(profile.compensation) ? profile.compensation : {};
    form.work_style = str(comp.location_flexibility);
    form.compensation = {
      currency: str(comp.currency) || "USD",
      target_range: str(comp.target_range),
      minimum: str(comp.minimum),
    };
    if (TIERS.includes(profile.spend_tier)) form.spend_tier = profile.spend_tier;
  }
  if (isObj(portals) && isObj(portals.location_filter)) {
    // Countries are the entries also under always_allow; the rest are cities.
    const always = new Set(strList(portals.location_filter.always_allow, 100));
    const allow = strList(portals.location_filter.allow, 100);
    form.search.countries = allow.filter((p) => always.has(p)).slice(0, MAX_PLACES);
    form.search.cities = allow.filter((p) => !always.has(p)).slice(0, MAX_PLACES);
  }
  return form;
}

/**
 * Replace the form-owned filters in an existing portals.yml document:
 * title_filter.positive and the location allow-list. Tracked companies and
 * every other block pass through.
 * @param {Record<string, any>} doc
 * @param {OnboardingForm} form
 */
export function mergeOnboardingPortals(doc, form) {
  const out = { ...doc };
  out.title_filter = { ...(isObj(doc.title_filter) ? doc.title_filter : {}), positive: [...form.target_roles] };
  const { countries, cities } = form.search;
  if (countries.length || cities.length) {
    const lf = { ...(isObj(doc.location_filter) ? doc.location_filter : {}) };
    lf.always_allow = [...countries];
    lf.allow = [...countries, ...cities];
    out.location_filter = lf;
  }
  // No places given leaves an existing location_filter alone: it may hold rules
  // the user wrote by hand, and an empty answer is not an instruction to drop them.
  return out;
}
