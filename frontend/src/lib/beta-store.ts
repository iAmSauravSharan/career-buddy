import { useSyncExternalStore } from "react";

// Phones have no room for the floating beta pill above the tab bar, so the
// More menu shows "Report a bug" instead. The banner publishes its version
// label here and registers the opener; the menu reads both.
let label: string | null = null;
let opener: (() => void) | null = null;
const subscribers = new Set<() => void>();

export function setBetaReporter(nextLabel: string | null, nextOpener: (() => void) | null) {
  label = nextLabel;
  opener = nextOpener;
  for (const fn of subscribers) fn();
}

export function openBetaReport() {
  opener?.();
}

function subscribe(fn: () => void) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

/** The pre-release version label ("0.15.0 · alpha"), or null on stable. */
export function useBetaLabel(): string | null {
  return useSyncExternalStore(subscribe, () => label, () => null);
}
