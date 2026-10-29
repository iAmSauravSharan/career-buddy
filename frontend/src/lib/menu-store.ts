import { useSyncExternalStore } from "react";

// Open state of the phone menu drawer, shared by the More tab (bottom-tabs) and
// the drawer itself (mobile-nav). A store rather than a window event, so a tap
// that lands before the drawer mounts its listener is never lost.
let open = false;
const subscribers = new Set<() => void>();

export function setMenuOpen(next: boolean) {
  if (open === next) return;
  open = next;
  for (const fn of subscribers) fn();
}

function subscribe(fn: () => void) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export function useMenuOpen(): boolean {
  return useSyncExternalStore(subscribe, () => open, () => false);
}
