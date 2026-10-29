// The onboarding stepper's steps and the check each one runs before Continue.
// The backend validates the whole form again on save (backend/src/lib/onboarding.mjs);
// this is only so a missing field is caught on its own step, not at the end.

/** @typedef {import("@shared/types").OnboardingForm} OnboardingForm */

export const STEPS = /** @type {const} */ ([
  { id: "details", title: "Your details", hint: "Name, email and where you're based" },
  { id: "roles", title: "Target roles", hint: "The jobs you want next" },
  { id: "location", title: "Where you'll work", hint: "Work style and places to search" },
  { id: "pay", title: "Compensation", hint: "Your target and walk-away pay" },
  { id: "ai", title: "AI usage", hint: "How much to spend per evaluation" },
  { id: "review", title: "All set", hint: "Review and finish" },
]);

const NOT_A_PLACE = /^(remote|hybrid|anywhere|on-?site)$/i;

/**
 * Errors for one step, keyed by field path. Empty when the step can continue.
 * @param {string} step
 * @param {OnboardingForm} form
 * @returns {Record<string, string>}
 */
export function stepErrors(step, form) {
  /** @type {Record<string, string>} */
  const e = {};
  if (step === "details") {
    if (!form.candidate.full_name.trim()) e["candidate.full_name"] = "Add your name";
    const email = form.candidate.email.trim();
    if (!email) e["candidate.email"] = "Add your email";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e["candidate.email"] = "That doesn't look like an email address";
    if (!form.location.country.trim()) e["location.country"] = "Add the country you live in";
    if (!form.location.timezone.trim()) e["location.timezone"] = "Pick your timezone";
  }
  if (step === "roles" && !form.target_roles.length) e.target_roles = "Add at least one role";
  if (step === "location") {
    const bad = [...form.search.countries, ...form.search.cities].find((p) => NOT_A_PLACE.test(p.trim()));
    if (bad) e.search = `"${bad}" is a work style, not a place. Pick it above instead.`;
  }
  if (step === "pay") {
    if (!form.compensation.currency.trim()) e["compensation.currency"] = "Pick a currency";
    if (!form.compensation.target_range.trim()) e["compensation.target_range"] = "Add a target range";
  }
  return e;
}

/**
 * The step a field belongs to, so an error from the server can open it.
 * @param {string | undefined} field
 */
export function stepOfField(field) {
  if (!field) return "review";
  if (field.startsWith("candidate") || field === "location.country" || field === "location.timezone") return "details";
  if (field === "target_roles") return "roles";
  if (field.startsWith("search") || field.startsWith("location")) return "location";
  if (field.startsWith("compensation")) return "pay";
  if (field === "spend_tier") return "ai";
  return "review";
}

/**
 * Add a chip value: trimmed, not empty, not already there (case-insensitive).
 * @param {string[]} list
 * @param {string} value
 * @param {number} [max]
 */
export function addChip(list, value, max = 12) {
  const v = value.trim().replace(/,+$/, "").trim();
  if (!v || list.length >= max || list.some((x) => x.toLowerCase() === v.toLowerCase())) return list;
  return [...list, v];
}
