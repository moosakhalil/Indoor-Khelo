"use client";
// Phase F3: a bottom sheet (phones) / centred card (wider). Closes with Escape, the Close button or a tap on the dim background; Tab stays inside.
import { useEffect, useId, useRef } from "react";
import { IconCross } from "@/components/B4Icons";
import "./pv.css";

export default function PvSheet({ open, title, sub, onClose, children }: { open: boolean; title: string; sub?: string; onClose: () => void; children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const tid = useId();
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    const first = box.current?.querySelector<HTMLElement>("input, button:not([data-close])");
    first?.focus();
    return () => before?.focus?.();
  }, [open]);
  if (!open) return null;
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
    if (e.key !== "Tab") return;
    const nodes = Array.from(box.current?.querySelectorAll<HTMLElement>("a[href], button:not(:disabled), input, textarea, select") ?? []);
    if (!nodes.length) return;
    const at = nodes.indexOf(document.activeElement as HTMLElement);
    if (e.shiftKey && at <= 0) { e.preventDefault(); nodes[nodes.length - 1]!.focus(); }
    else if (!e.shiftKey && at === nodes.length - 1) { e.preventDefault(); nodes[0]!.focus(); }
  };
  return (
    <div className="pv-sheetwrap" onKeyDown={onKey}>
      <div className="pv-sheetbg" aria-hidden="true" onClick={onClose} />
      <div ref={box} className="pv-sheet" role="dialog" aria-modal="true" aria-labelledby={tid}>
        <span className="pv-grip" aria-hidden="true" />
        <div className="row space">
          <div><h2 id={tid}>{title}</h2>{sub && <small className="muted">{sub}</small>}</div>
          <button type="button" data-close className="pv-x" onClick={onClose} aria-label="Close"><IconCross size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
