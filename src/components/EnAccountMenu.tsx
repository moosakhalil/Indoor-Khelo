"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import EnIcon from "@/components/EnIcons";
import SignOutButton from "@/components/SignOutButton";

/** The round account button in the top bar of the entry pages. Opens a small menu with the name, the Account page
 *  (only once the Terms are accepted, because /account needs that) and Log out. Not an initials avatar: the person
 *  is a player, and players are only ever shown as the shirt, so the button is a plain person icon. */
export default function EnAccountMenu({ name, showAccount = true }: { name: string; showAccount?: boolean }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") { setOpen(false); trigger.current?.focus(); }
  }

  return (
    <div className="en-acct" ref={root} onKeyDown={onKey}>
      <button
        ref={trigger}
        type="button"
        className="en-acct-btn"
        aria-label="Account menu"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        <EnIcon name="person" size={22} />
      </button>
      {open && (
        <div className="en-acct-pop card" id={id} role="group" aria-label="Account">
          <p className="en-acct-name"><span className="muted small">Signed in as</span><b>{name}</b></p>
          {showAccount && (
            <Link href="/account" className="btn ghost en-acct-link"><EnIcon name="cog" size={18} />Account</Link>
          )}
          <SignOutButton />
        </div>
      )}
    </div>
  );
}
