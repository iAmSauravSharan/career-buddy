"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

// One overlay for the whole app: a bottom sheet on phones, a centred dialog
// from md up. Details live here instead of crowding the page (the "3 to 5
// things on screen" rule): edit search, a job's quick view, change stage, log
// a follow-up.
//
// Modal behaviour: scroll lock, Escape and scrim close, Tab trapped inside,
// focus moved in on open and handed back to the opener on close. On touch the
// grab handle drags the sheet down; past 90px it closes.

const STYLE = `
.co-sheet-scrim{position:fixed;inset:0;z-index:80;background:rgb(15 17 21/.45);animation:co-fade .2s ease}
.co-sheet{position:fixed;z-index:81;display:flex;flex-direction:column;max-height:calc(100dvh - 2.5rem);background:var(--surface);color:var(--fg);
  left:0;right:0;bottom:0;border-radius:1.375rem 1.375rem 0 0;padding-bottom:env(safe-area-inset-bottom);animation:co-sheet-up .32s cubic-bezier(.32,.72,0,1);box-shadow:0 -16px 48px -24px rgb(0 0 0/.35)}
@media (min-width:768px){.co-sheet{left:50%;right:auto;bottom:auto;top:50%;width:min(32rem,calc(100vw - 3rem));max-height:min(44rem,calc(100dvh - 4rem));border-radius:1rem;transform:translate(-50%,-50%);padding-bottom:0;animation:co-fade .18s ease;box-shadow:0 24px 64px -16px rgb(0 0 0/.35)}}
@keyframes co-sheet-up{from{transform:translateY(100%)}to{transform:translateY(0)}}
@keyframes co-fade{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion:reduce){.co-sheet,.co-sheet-scrim{animation:none}}
`;

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  /** Pinned under the scrolling body: the sheet's one primary action. */
  footer?: React.ReactNode;
  className?: string;
}) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const f = panel.current.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (f.length === 0) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    // Focus the first field if there is one, else the panel itself.
    const t = window.setTimeout(() => {
      const field = panel.current?.querySelector<HTMLElement>("input, select, textarea");
      (field ?? panel.current)?.focus();
    }, 30);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [open]);

  // Drag-to-close from the grab handle (touch only).
  const drag = useRef({ y0: 0, dy: 0 });
  const onTouchStart = (e: React.TouchEvent) => {
    drag.current = { y0: e.touches[0].clientY, dy: 0 };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!panel.current) return;
    const dy = Math.max(0, e.touches[0].clientY - drag.current.y0);
    drag.current.dy = dy;
    panel.current.style.transition = "none";
    panel.current.style.transform = `translateY(${dy}px)`;
  };
  const onTouchEnd = () => {
    if (!panel.current) return;
    panel.current.style.transition = "transform .2s ease";
    panel.current.style.transform = "";
    if (drag.current.dy > 90) onClose();
  };

  if (!open || !mounted) return null;
  return createPortal(
    <>
      <style>{STYLE}</style>
      <div className="co-sheet-scrim" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={description ? `${id}-desc` : undefined}
        tabIndex={-1}
        className={cn("co-sheet outline-none", className)}
      >
        <div
          className="flex shrink-0 justify-center pb-1 pt-2.5 md:hidden"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          aria-hidden
        >
          <span className="h-1 w-10 rounded-full bg-border" />
        </div>
        <div className="flex shrink-0 items-start gap-3 px-4 pb-1 pt-1 md:px-6 md:pt-5">
          <div className="min-w-0 flex-1">
            <h2 id={`${id}-title`} className="text-title text-foreground">{title}</h2>
            {description && <p id={`${id}-desc`} className="mt-0.5 text-caption text-faint">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 -mt-1 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-2 md:px-6">{children}</div>
        {footer && <div className="shrink-0 border-t border-border px-4 py-3 md:px-6 md:py-4">{footer}</div>}
      </div>
    </>,
    document.body,
  );
}
