"use client";
// Small shared pieces of Plan several matches and Rematch.
import { useEffect, useState } from "react";
import Link from "next/link";
import { SvLock, SvWarn } from "@/components/C2Icons";
import type { FailBanner } from "@/lib/c2";

/** Sends the phone's time zone with the form, so "7:30 pm" means 7:30 pm where the player is. Same behaviour as the old forms. */
export function TzField() {
  const [tz, setTz] = useState("");
  useEffect(() => { try { setTz(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch { setTz(""); } }, []);
  return <input type="hidden" name="tz" value={tz} />;
}

/** An error under its own field: icon and words, never colour alone. */
export function SvErr({ text, id }: { text?: string; id?: string }) {
  if (!text) return null;
  return <p className="sv-err" role="alert" id={id} data-sv-err="1"><SvWarn size={14} /><span>{text}</span></p>;
}

/** A server failure as a banner with an icon and, when there is one, the sensible next step. */
export function SvBanner({ banner, planHref, onRetry, busy }: { banner: FailBanner; planHref?: string; onRetry?: () => void; busy?: boolean }) {
  return (
    <div className="sv-fail" role="alert" data-sv-err="1">
      <div className="sv-banner red">
        {banner.icon === "lock" ? <SvLock size={18} /> : <SvWarn size={18} />}
        <div><b>{banner.headline}</b>{banner.detail && <span>{banner.detail}</span>}</div>
      </div>
      {banner.next === "plan" && planHref && <Link href={planHref} className="btn ghost sv-next">Plan a new match instead</Link>}
      {banner.next === "retry" && onRetry && <button type="button" className="btn ghost sv-next" disabled={busy} onClick={onRetry}>Try again</button>}
    </div>
  );
}
