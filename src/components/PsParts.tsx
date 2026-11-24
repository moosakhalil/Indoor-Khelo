"use client";
// Phase E2 (UI redesign): the building blocks of the pad's sheets. They only draw and report taps; every sheet in
// PadSheets.tsx still builds the same event bodies and hands them to `add` exactly as before.
import { useEffect, useId, useRef } from "react";
import PsIcon from "@/components/PsIcons";
import Shirt from "@/components/Shirt";
import TeamBadge from "@/components/TeamBadge";
import type { MatchState, PlayerEntry } from "@/lib/engine/types";
import "./ps.css";

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

/* ---------- the sheet itself ---------- */
export type PsSheetProps = {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** One short line under the title (who and which ball, the score, the rule). */
  subtitle?: React.ReactNode;
  /** A bar of step segments under the header: done / total. */
  progress?: { done: number; total: number; label: string };
  /** The buttons that stay at the bottom while the content scrolls. */
  foot?: React.ReactNode;
};

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function PsSheet({ title, onClose, children, subtitle, progress, foot }: PsSheetProps) {
  const sheet = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    sheet.current?.focus({ preventScroll: true });
    return () => { if (before && before.isConnected) before.focus?.({ preventScroll: true }); };
  }, []);
  const keys = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); closeRef.current(); return; }
    if (e.key !== "Tab" || !sheet.current) return;
    const items = Array.from(sheet.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (!items.length) return;
    const first = items[0]!, last = items[items.length - 1]!;
    if (e.shiftKey && (document.activeElement === first || document.activeElement === sheet.current)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  return (
    <div className="ps-wrap" role="dialog" aria-modal="true" aria-label={title} onKeyDown={keys}>
      <button type="button" className="ps-bg" aria-label="Close this panel" onClick={onClose} tabIndex={-1} />
      <div className="ps-sheet" ref={sheet} tabIndex={-1}>
        <div className="ps-grab" aria-hidden="true" />
        <div className="ps-head">
          <div className="ps-head-t">
            <h2>{title}</h2>
            {subtitle ? <p className="ps-sub">{subtitle}</p> : null}
          </div>
          <button type="button" className="ps-x" aria-label="Close" onClick={onClose}><PsIcon name="x" /></button>
        </div>
        {progress && progress.total > 0 && (
          <div className="ps-prog" role="progressbar" aria-label={progress.label} aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}>
            {Array.from({ length: progress.total }, (_, i) => <span key={i} className={cx("ps-seg", i < progress.done && "on")} />)}
          </div>
        )}
        <div className={cx("ps-body", !foot && "nofoot")}>{children}</div>
        {foot ? <div className="ps-foot">{foot}</div> : null}
      </div>
    </div>
  );
}

/* ---------- small pieces ---------- */
export function PsHeading({ children, id }: { children: React.ReactNode; id?: string }) {
  return <h3 className="ps-h" id={id}>{children}</h3>;
}

export function Banner({ tone = "info", icon, title, children, role }: { tone?: "info" | "warn" | "red" | "green"; icon?: "alert" | "info" | "check" | "clock" | "lock"; title?: React.ReactNode; children?: React.ReactNode; role?: "alert" | "status" }) {
  return (
    <div className={cx("ps-banner", tone)} role={role}>
      {icon && <PsIcon name={icon} />}
      <div className="ps-banner-t">{title ? <b>{title}</b> : null}{children ? <span>{children}</span> : null}</div>
    </div>
  );
}

/** What will be recorded, read back in words before the button is pressed. */
export function Readback({ children, tone }: { children: React.ReactNode; tone?: "red" | "gold" | "green" }) {
  return <div className={cx("ps-read", tone)} role="status" aria-live="polite">{children}</div>;
}

/** A large tile with a title and an optional one-line sub-title (kept out of the accessible name, read as its description). */
export function Tile({ on, onClick, disabled, title, sub, tone, bad, full }: { on?: boolean; onClick?: () => void; disabled?: boolean; title: React.ReactNode; sub?: React.ReactNode; tone?: "red"; bad?: boolean; full?: boolean }) {
  const id = useId();
  return (
    <button type="button" className={cx("ps-tile", tone, bad && "bad", full && "full")} aria-pressed={!!on} disabled={disabled} onClick={onClick}
      aria-labelledby={sub ? `${id}t` : undefined} aria-describedby={sub ? `${id}s` : undefined}>
      <span id={`${id}t`} className="ps-tile-t">{title}</span>
      {sub ? <small id={`${id}s`} className="ps-tile-s">{sub}</small> : null}
    </button>
  );
}

/** A short pill-shaped choice (runs 0..4, kinds of ball): same press behaviour as a tile. */
export function Pick({ on, onClick, disabled, children, bad, tone }: { on?: boolean; onClick?: () => void; disabled?: boolean; children: React.ReactNode; bad?: boolean; tone?: "red" }) {
  return <button type="button" className={cx("ps-pick", tone, bad && "bad")} aria-pressed={!!on} disabled={disabled} onClick={onClick}>{children}</button>;
}

export function Group({ label, children, cols, bad }: { label: string; children: React.ReactNode; cols?: 2 | 3 | 4 | 5; bad?: boolean }) {
  return <div className={cx("ps-grid", cols && `c${cols}`, bad && "bad")} role="group" aria-label={label}>{children}</div>;
}

/** Segmented control (two or three exclusive options). */
export function Seg({ label, options, value, onChange }: { label: string; options: { value: string; label: React.ReactNode; aria?: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="ps-seg-ctl" role="group" aria-label={label}>
      {options.map((o) => <button key={o.value} type="button" aria-pressed={value === o.value} aria-label={o.aria} onClick={() => onChange(o.value)}>{o.label}</button>)}
    </div>
  );
}

/* ---------- people ---------- */
export function PlayerFace({ p, size = "small" }: { p: PlayerEntry; size?: "small" | "normal" }) {
  return <span className="ps-face" aria-hidden="true"><Shirt number={p.kind === "guest" ? null : p.number} size={size} /></span>;
}

export function PlayerTile({ p, on, onClick, disabled, note, gone, bad }: { p: PlayerEntry; on?: boolean; onClick?: () => void; disabled?: boolean; note?: React.ReactNode; gone?: boolean; bad?: boolean }) {
  const id = useId();
  return (
    <button type="button" className={cx("ps-ptile", gone && "gone", bad && "bad")} aria-pressed={!!on} disabled={disabled} onClick={onClick}
      aria-labelledby={`${id}n`} aria-describedby={note ? `${id}s` : undefined}>
      <PlayerFace p={p} />
      <span className="ps-ptile-x">
        <span id={`${id}n`} className="ps-ptile-n">{p.name}</span>
        {note ? <small id={`${id}s`} className="ps-tile-s">{note}</small> : null}
      </span>
    </button>
  );
}

/** A group of player tiles. `none` adds a leading tile for "nobody / no preference". */
export function PlayerPicker({ m, ids, value, onChange, group, none, note, off, gone, bad, cols = 2 }: {
  m: MatchState; ids: string[]; value: string; onChange: (id: string) => void; group: string;
  none?: { label: string; sub?: string }; note?: (p: PlayerEntry) => React.ReactNode; off?: (p: PlayerEntry) => boolean; gone?: (p: PlayerEntry) => boolean; bad?: boolean; cols?: 2 | 3;
}) {
  return (
    <Group label={group} cols={cols} bad={bad}>
      {none && <Tile on={value === ""} onClick={() => onChange("")} title={none.label} sub={none.sub} bad={bad && value === ""} />}
      {ids.map((id) => {
        const p = m.players[id];
        if (!p) return null;
        return <PlayerTile key={id} p={p} on={value === id} onClick={() => onChange(id)} disabled={off?.(p)} gone={gone?.(p)} note={note ? note(p) : p.kind === "guest" ? "Guest" : undefined} bad={bad && value === id} />;
      })}
    </Group>
  );
}

/** A team: its badge and name (the badge is decorative, the name is the label). */
export function SideChip({ name, on, onClick }: { name: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" className="ps-side" aria-pressed={on} onClick={onClick}>
      <span aria-hidden="true"><TeamBadge name={name} size="sm" /></span>
      <span className="ps-side-n">{name}</span>
    </button>
  );
}

/* ---------- number stepper ---------- */
export function Stepper({ id, label, value, onChange, min, max, unit, invalid, lessLabel, moreLabel }: {
  id: string; label: string; value: string; onChange: (v: string) => void; min: number; max: number; unit?: string; invalid?: boolean; lessLabel: string; moreLabel: string;
}) {
  const n = Number(value);
  const ok = value.trim() !== "" && Number.isInteger(n);
  const set = (k: number) => onChange(String(Math.min(max, Math.max(min, k))));
  return (
    <div className="ps-step">
      <button type="button" className="ps-step-b" aria-label={lessLabel} disabled={ok && n <= min} onClick={() => set(ok ? n - 1 : min)}><PsIcon name="minus" /></button>
      <div className={cx("ps-step-f", invalid && "bad")}>
        <input id={id} className="ps-step-i" inputMode="numeric" aria-label={label} aria-invalid={invalid || undefined} value={value} onChange={(e) => onChange(e.target.value)} />
        {unit ? <span className="ps-step-u" aria-hidden="true">{unit}</span> : null}
      </div>
      <button type="button" className="ps-step-b" aria-label={moreLabel} disabled={ok && n >= max} onClick={() => set(ok ? n + 1 : min)}><PsIcon name="plus" /></button>
    </div>
  );
}

/** A number or word field with its unit shown inside (for example "runs"). */
export function UnitField({ id, label, value, onChange, unit, invalid, placeholder, inputMode = "numeric" }: { id?: string; label: string; value: string; onChange: (v: string) => void; unit?: string; invalid?: boolean; placeholder?: string; inputMode?: "numeric" | "text" }) {
  return (
    <div className={cx("ps-step-f", "solo", invalid && "bad")}>
      <input id={id} className="ps-step-i left" inputMode={inputMode} aria-label={label} aria-invalid={invalid || undefined} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {unit ? <span className="ps-step-u" aria-hidden="true">{unit}</span> : null}
    </div>
  );
}

/* ---------- buttons at the foot of a sheet ---------- */
/** The main button. `ready` false shows the missing step as its label; it stays pressable only when `soft` (to show errors on press). */
export function MainButton({ ready, label, missing, onClick, tone = "gold", soft, plain }: { ready: boolean; label: React.ReactNode; missing: React.ReactNode; onClick: () => void; tone?: "gold" | "red"; soft?: boolean; plain?: boolean }) {
  return (
    <button type="button" className={cx("ps-main", tone, !ready && "wait")} disabled={!ready && !soft} aria-disabled={!ready || undefined} onClick={onClick}>
      {ready ? <>{tone === "gold" && !plain && <PsIcon name="check" />}{label}</> : missing}
    </button>
  );
}

export function CancelButton({ onClick, children = "Cancel" }: { onClick: () => void; children?: React.ReactNode }) {
  return <button type="button" className="ps-cancel" onClick={onClick}>{children}</button>;
}
