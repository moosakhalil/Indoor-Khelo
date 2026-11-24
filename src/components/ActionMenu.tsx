"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";

// A "three dots" menu for the edit / delete / more actions of a row or a page.
// Works with a tap, a mouse click and the keyboard (Enter, arrow keys, Escape). Every item is a real
// link or button with a word on it, so it is also readable by a screen reader.

export type ActionItem = {
  label: string;
  /** A link to another page. */
  href?: string;
  /** Or a button that does something in the browser (open a confirm dialog, start an undo, ...). */
  onSelect?: () => void;
  /** Red text for delete and other actions that cannot be taken lightly. */
  danger?: boolean;
  disabled?: boolean;
  /** A short reason shown under the label when the item is disabled. */
  hint?: string;
};

export default function ActionMenu({ items, label = "More actions", align = "right" }: { items: ActionItem[]; label?: string; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) trigger.current?.focus();
  }, []);

  // Close on a click or touch outside, and on Escape.
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  // When the menu opens, focus the first item that can be used.
  useEffect(() => {
    if (!open) return;
    const first = root.current?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])');
    first?.focus();
  }, [open]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close(true);
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
    const all = Array.from(root.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? []);
    if (!all.length) return;
    e.preventDefault();
    const at = all.indexOf(document.activeElement as HTMLElement);
    let next = at;
    if (e.key === "ArrowDown") next = at < 0 ? 0 : (at + 1) % all.length;
    if (e.key === "ArrowUp") next = at <= 0 ? all.length - 1 : at - 1;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = all.length - 1;
    all[next]!.focus();
  };

  if (!items.length) return null;

  return (
    <div className="menu" ref={root} onKeyDown={onKey}>
      <button
        type="button"
        ref={trigger}
        className="menu-btn"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>
      </button>
      {open && (
        <div id={menuId} role="menu" aria-label={label} className={`menu-pop ${align}`}>
          {items.map((it) => {
            const cls = `menu-item${it.danger ? " danger" : ""}`;
            const inner = (
              <>
                <span>{it.label}</span>
                {it.disabled && it.hint && <small>{it.hint}</small>}
              </>
            );
            if (it.href && !it.disabled) {
              return (
                <Link key={it.label} role="menuitem" href={it.href} className={cls} onClick={() => close(false)}>
                  {inner}
                </Link>
              );
            }
            return (
              <button
                key={it.label}
                type="button"
                role="menuitem"
                className={cls}
                aria-disabled={it.disabled ? true : undefined}
                onClick={() => {
                  if (it.disabled) return;
                  close(false);
                  it.onSelect?.();
                }}
              >
                {inner}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
