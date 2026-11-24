"use client";
// A bottom sheet on a phone and a dialog on a wider screen. Escape and the backdrop close it, focus moves in and comes back,
// Tab stays inside. Used by the leaderboard filters and the compare player chooser.
import "./ld.css";
import { useEffect, useId, useRef } from "react";
import { IconClose } from "@/components/LdIcons";

export default function LdSheet({ open, onClose, title, hint, children }: { open: boolean; onClose: () => void; title: string; hint?: string; children: React.ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const hintId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    const focusables = () => Array.from(panel.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea, [tabindex]:not([tabindex='-1'])") ?? []).filter((el) => !el.hasAttribute("hidden"));
    const first = panel.current?.querySelector<HTMLElement>("[data-autofocus]") ?? focusables().find((el) => !el.classList.contains("ld-sheet-x"));
    first?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onCloseRef.current(); return; }
      if (e.key !== "Tab") return;
      const f = focusables();
      if (!f.length) return;
      const a = f[0]!, z = f[f.length - 1]!;
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); before?.focus?.(); };
  }, [open]);

  if (!open) return null;
  return (
    <div className="ld-sheet-wrap">
      <button type="button" className="ld-sheet-bg" aria-label="Close" tabIndex={-1} onClick={onClose} />
      <div className="ld-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={hint ? hintId : undefined} ref={panel}>
        <span className="ld-sheet-grip" aria-hidden="true" />
        <div className="ld-sheet-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="ld-sheet-x" aria-label="Close" onClick={onClose}><IconClose size={18} /></button>
        </div>
        {hint && <p id={hintId} className="muted small ld-sheet-hint">{hint}</p>}
        {children}
      </div>
    </div>
  );
}
