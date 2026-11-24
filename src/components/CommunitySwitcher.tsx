"use client";
// The community switcher. Tap the community name (top bar on Home, sidebar on a desktop): a bottom sheet on a phone,
// a small menu next to the button on a tablet or desktop. Lists the person's communities (role, number, members),
// shortcuts to the other places in this community, and Create another / Join another.
// The panel is drawn into <body> because the top bar and the sidebar use a blurred glass background, which would
// otherwise trap a fixed panel inside them.
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import CommunityLogo from "@/components/CommunityLogo";
import CommunityRow from "@/components/CommunityRow";
import HmIcon, { type HmIconName } from "@/components/HmIcons";
import type { SwitcherCommunity } from "@/lib/shellData";
import "./shell.css";

const PLACES: { label: string; path: string; icon: HmIconName }[] = [
  { label: "Series", path: "/series", icon: "trophy" },
  { label: "Leaderboard", path: "/leaderboard", icon: "chart" },
  { label: "Insights", path: "/insights", icon: "target" },
  { label: "Members", path: "/members", icon: "people" },
  { label: "Alerts", path: "/alerts", icon: "bell" },
  { label: "Community", path: "/community", icon: "shield" },
];

export default function CommunitySwitcher({
  communityId, communityName, items, variant = "topbar",
}: { communityId: string; communityName: string; items: SwitcherCommunity[]; variant?: "topbar" | "sidebar" }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => setMounted(true), []);

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) trigger.current?.focus();
  }, []);

  const openIt = () => {
    // From 640 px up the panel is a menu next to the button; below that it is a bottom sheet (set by the CSS).
    const wide = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(min-width: 640px)").matches;
    const r = trigger.current?.getBoundingClientRect();
    if (wide && r) setPos({ top: Math.round(r.bottom + 8), left: Math.round(Math.max(12, Math.min(r.left, window.innerWidth - 392))) });
    else setPos(null);
    setOpen(true);
  };

  // While open: Escape closes, Tab stays inside the panel, the page behind does not scroll, focus starts in the panel.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("button, a")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); close(); return; }
      if (e.key !== "Tab" || !panel.current) return;
      const f = Array.from(panel.current.querySelectorAll<HTMLElement>("button, a[href]")).filter((el) => !el.hasAttribute("disabled"));
      if (!f.length) return;
      const first = f[0]!, last = f[f.length - 1]!;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); };
  }, [open, close]);

  const base = `/c/${communityId}`;
  const alone = items.length <= 1;
  const label = `Switch community. Now in ${communityName}`;

  const sheet = open && mounted ? createPortal(
    <>
      <div className="hm-sw-back" onClick={() => close(false)} aria-hidden="true" />
      <div ref={panel} className="hm-sw" role="dialog" aria-modal="true" aria-labelledby={titleId} style={pos ? { top: pos.top, left: pos.left } : undefined}>
        <div className="hm-sw-grip" aria-hidden="true" />
        <div className="row space">
          <h2 id={titleId} className="hm-sw-h">Your communities</h2>
          <button type="button" className="hm-sw-x" aria-label="Close" onClick={() => close()}><HmIcon name="close" /></button>
        </div>
        <p className="muted small" style={{ margin: "2px 0 10px" }}>
          {alone ? "You are in one community. You can create another or join one with a code." : "Tap to switch. You stay signed in."}
        </p>
        {/* any tap on a community link closes the panel; the page change does the rest */}
        <div className="stack" style={{ gap: 8 }} onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }}>
          {items.map((c) => (
            <CommunityRow key={c.id} id={c.id} name={c.name} role={c.role} number={c.number} members={c.members} current={c.id === communityId} />
          ))}
          {items.length === 0 && <CommunityRow id={communityId} name={communityName} role="member" number={null} current />}
        </div>
        <p className="hm-sw-sub">In this community</p>
        <div className="hm-sw-grid" onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }}>
          {PLACES.map((p) => (
            <Link key={p.path} href={`${base}${p.path}`}><HmIcon name={p.icon} size={22} /><span>{p.label}</span></Link>
          ))}
        </div>
        <div className="two" style={{ marginTop: 12 }} onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }}>
          <Link href="/create" className="btn ghost small" style={{ width: "100%" }}><HmIcon name="plus" /> Create another</Link>
          <Link href="/join" className="btn ghost small" style={{ width: "100%" }}><HmIcon name="userplus" /> Join another</Link>
        </div>
      </div>
    </>,
    document.body,
  ) : null;

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={variant === "sidebar" ? "hm-sw-side" : "hm-sw-trigger"}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        onClick={() => (open ? close(false) : openIt())}
      >
        {variant === "sidebar" && <CommunityLogo name={communityName} />}
        <span className="hm-sw-name">{variant === "sidebar" ? <><b>{communityName}</b><small className="muted">Switch community</small></> : communityName}</span>
        <HmIcon name="down" size={16} />
      </button>
      {sheet}
    </>
  );
}
