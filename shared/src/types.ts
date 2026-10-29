/**
 * Types that cross the frontend/backend boundary as JSON. Both apps import
 * them as `@shared/types`; keep this file free of runtime code and of any
 * server-only import, so the frontend bundle never pulls in the backend.
 */

import type { ExploreFilters } from "./explore";

/** A pending posting in data/pipeline.md (the inbox). */
export type InboxJob = { url: string; company: string; role: string; location?: string; compensation?: string; done: boolean; postedAt?: string };

/** One row of the applications tracker. */
export type Application = {
  n: string;
  date: string;
  company: string;
  /** Intermediary channel (#1596): agency/recruiter firm, "—" for direct, "" when the tracker has no Via column. */
  via: string;
  role: string;
  /** Tracker's `Location` column — recognized by the alias table; "" when the tracker has no such column. */
  location: string;
  score: string;
  status: string;
  pdf: string;
  report: string;
  /** Tracker's `Apply Link` column — usually a markdown link to the original ad; "" when the column is absent. */
  applyLink: string;
  /** Tracker's `Follow-up` column — a date or "—"; "" when the column is absent. */
  followUp: string;
  notes: string;
  /** Tracker's `URL` column. A raw URL or a markdown link. "" when the column is absent. */
  url: string;
};

/** A company entry in portals.yml as the Portals page lists it. */
export type WatchedCompany = { name: string; enabled: boolean; host: string };

/** One control of an application form, as the apply flow extracted it. */
export type ApplyField = {
  id: string; // our stable handle, also set as data-co-field on the live element
  type: "text" | "email" | "tel" | "url" | "number" | "date" | "textarea" | "select" | "checkbox" | "radio" | "file";
  label: string;
  required: boolean;
  options?: string[];
  maxLength?: number;
  value?: string;
  combobox?: boolean; // react-select-style widget → fill via click+type+Enter, not selectOption
  nativeId?: string; // the live element's id/name — used to match ATS API schemas (Greenhouse)
  nativeName?: string;
};

// Scheduled scans.
export type JobStatus = "active" | "paused" | "deleted";
export type ScanEngine = "full" | "portals";
export type ScheduleUnit = "minutes" | "hours" | "days";

export type ScheduledJob = {
  id: string;
  name: string;
  status: JobStatus;
  engine: ScanEngine;
  filters: ExploreFilters;
  timezone: string;
  startAt: string;
  nextRunAt?: string;
  every: number;
  unit: ScheduleUnit;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  lastError?: string;
  rolesFoundCount?: number;
};

export type JobRun = {
  id: string;
  jobId: string;
  at: string;
  durationMs?: number;
  state: "queued" | "running" | "success" | "failed" | "cancelled";
  attempt: number;
  message?: string;
  rolesFound?: number;
  engine?: ScanEngine;
};

export type SpendTier = "economy" | "standard" | "premium";

/** The onboarding stepper's form: GET /api/views/onboarding returns it, POST /api/onboarding saves it. */
export type OnboardingForm = {
  candidate: { full_name: string; email: string; phone: string; linkedin: string; portfolio_url: string };
  location: { city: string; country: string; timezone: string; needs_sponsorship: boolean; authorized_in: string[] };
  target_roles: string[];
  work_style: string;
  compensation: { currency: string; target_range: string; minimum: string };
  spend_tier: SpendTier;
  search: { countries: string[]; cities: string[] };
};
