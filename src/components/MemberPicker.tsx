"use client";
// Choose one member: their gold shirt and name, with a search box. Replaces the plain dropdown with "(7)" numbers.
// The chosen person's id goes in a hidden field, so the form sends exactly what the old dropdown sent.
import "./b4.css";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import Shirt from "@/components/Shirt";

export type PickPerson = { user_id: string; name: string; player_number: number | null };

export default function MemberPicker({ label, name, value, onChange, members, error }: {
  label: string; name: string; value: string; onChange: (id: string) => void; members: PickPerson[]; error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const labelId = useId();
  const listId = useId();
  const btnId = useId();
  const chosen = members.find((m) => m.user_id === value) ?? null;
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? members.filter((m) => m.name.toLowerCase().includes(s)) : members;
  }, [members, q]);

  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const pick = (id: string) => { onChange(id); setOpen(false); setQ(""); btn.current?.focus(); };

  return (
    <div className="tm-pick" ref={root} onKeyDown={(e) => { if (e.key === "Escape" && open) { e.stopPropagation(); setOpen(false); btn.current?.focus(); } }}>
      <span className="lb" id={labelId}>{label}</span>
      <input type="hidden" name={name} value={value} />
      <button type="button" id={btnId} ref={btn} className={`field tm-pick-btn${error ? " bad" : ""}`} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined} aria-labelledby={`${labelId} ${btnId}`} aria-invalid={!!error} onClick={() => setOpen((v) => !v)}>
        {chosen ? (<><Shirt number={chosen.player_number} size="small" /><span className="tm-pick-name">{chosen.name}</span></>) : <span className="muted">Not chosen</span>}
        <span className="tm-pick-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="tm-pick-pop">
          <input type="search" className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search members" aria-label={`Search members for ${label}`} autoFocus autoComplete="off" />
          <ul id={listId} role="listbox" aria-labelledby={labelId}>
            <li role="presentation"><button type="button" role="option" aria-selected={!value} className="tm-opt" onClick={() => pick("")}>Not chosen</button></li>
            {shown.map((m) => (
              <li key={m.user_id} role="presentation">
                <button type="button" role="option" aria-selected={m.user_id === value} className={`tm-opt${m.user_id === value ? " on" : ""}`} onClick={() => pick(m.user_id)}>
                  <Shirt number={m.player_number} size="small" /><span>{m.name}</span>{m.user_id === value && <span className="tm-opt-tick" aria-hidden="true">✓</span>}
                </button>
              </li>
            ))}
            {shown.length === 0 && <li className="muted small tm-opt-none">No member has that name.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
