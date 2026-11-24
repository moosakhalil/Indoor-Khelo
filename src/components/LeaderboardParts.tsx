// Leaderboard screen parts that need no interaction, so the server draws them: group tabs, stat chips, order chip, the
// active filter chips, "your rank" card, podium, and the rule note.
import "./ld.css";
import Link from "next/link";
import { IconClose, IconInfo, IconSwap } from "@/components/LdIcons";
import Shirt from "@/components/Shirt";
import { GROUPS, STATS, ordinal, type BoardRow, type StatDef } from "@/lib/career";
import { orderLabel, type RankCard } from "@/lib/ldView";

export type LbFilters = { team: string | null; series: string | null; from: string | null; to: string | null };

/** One place that builds every leaderboard link, so a group, stat, order or filter change keeps the others. */
export function lbHref(communityId: string, p: { group?: string; stat?: string; flip?: boolean } & Partial<LbFilters>): string {
  const q = new URLSearchParams();
  if (p.group) q.set("group", p.group);
  if (p.stat) q.set("stat", p.stat);
  if (p.flip) q.set("flip", "1");
  if (p.team) q.set("team", p.team);
  if (p.series) q.set("series", p.series);
  if (p.from) q.set("from", p.from);
  if (p.to) q.set("to", p.to);
  const s = q.toString();
  return `/c/${communityId}/leaderboard${s ? `?${s}` : ""}`;
}

export function GroupTabs({ communityId, group, filters }: { communityId: string; group: StatDef["group"]; filters: LbFilters }) {
  return (
    <nav className="ld-seg" aria-label="Group">
      {GROUPS.map((g) => (
        <Link key={g.key} href={lbHref(communityId, { group: g.key, ...filters })} className={group === g.key ? "on" : undefined} aria-current={group === g.key ? "page" : undefined}>{g.label}</Link>
      ))}
    </nav>
  );
}

export function StatChips({ communityId, group, def, filters }: { communityId: string; group: StatDef["group"]; def: StatDef; filters: LbFilters }) {
  return (
    <nav className="ld-chips" aria-label="Statistic">
      {STATS.filter((s) => s.group === group).map((s) => (
        <Link key={s.key} href={lbHref(communityId, { stat: s.key, ...filters })} className={`ld-chip${def.key === s.key ? " on" : ""}`} aria-current={def.key === s.key ? "true" : undefined}>{s.label}</Link>
      ))}
    </nav>
  );
}

export function OrderChip({ communityId, def, flip, filters }: { communityId: string; def: StatDef; flip: boolean; filters: LbFilters }) {
  return (
    <Link href={lbHref(communityId, { stat: def.key, flip: !flip, ...filters })} className="ld-chipbtn" title={flip ? "Reversed order. Tap to go back." : "Tap to reverse the order."}>
      <IconSwap size={16} /> {orderLabel(def, flip)}{flip && <span className="ld-chipnote"> · Reversed order</span>}
    </Link>
  );
}

/** Each filter that is on is a chip with a close icon; tapping it removes only that filter. */
export function ActiveFilters({ communityId, def, flip, filters, seriesName, teamName, rangeText }: {
  communityId: string; def: StatDef; flip: boolean; filters: LbFilters; seriesName: string | null; teamName: string | null; rangeText: string | null;
}) {
  const chips: { key: string; text: string; href: string }[] = [];
  const without = (k: "series" | "team" | "range"): LbFilters => ({ ...filters, series: k === "series" ? null : filters.series, team: k === "team" ? null : filters.team, from: k === "range" ? null : filters.from, to: k === "range" ? null : filters.to });
  if (filters.series && seriesName) chips.push({ key: "series", text: `Series: ${seriesName}`, href: lbHref(communityId, { stat: def.key, flip, ...without("series") }) });
  if (filters.team && teamName) chips.push({ key: "team", text: `Team: ${teamName}`, href: lbHref(communityId, { stat: def.key, flip, ...without("team") }) });
  if (rangeText) chips.push({ key: "range", text: rangeText, href: lbHref(communityId, { stat: def.key, flip, ...without("range") }) });
  if (!chips.length) return null;
  return (
    <ul className="ld-active" aria-label="Filters that are on">
      {chips.map((c) => (
        <li key={c.key}>
          <Link href={c.href} className="ld-fchip" aria-label={`Remove filter ${c.text}`}>{c.text}<IconClose size={14} /></Link>
        </li>
      ))}
    </ul>
  );
}

export function RankCardView({ card, def, number, name }: { card: RankCard; def: StatDef; number: number | null; name: string }) {
  if (!card) return null;
  if (card.kind === "unranked") {
    return (
      <section className="ld-rank-card" aria-label="Your rank">
        <Shirt number={number} size="normal" label={name} />
        <div className="ld-rank-main">
          <span className="ld-eyebrow">YOUR RANK · {def.label.toUpperCase()}</span>
          <b className="ld-rank-big small">Not ranked yet</b>
          <p className="muted small ld-rank-note">You are not ranked yet. {card.reason}{card.progress && <> {card.progress}</>}</p>
        </div>
      </section>
    );
  }
  return (
    <section className="ld-rank-card gold" aria-label="Your rank">
      <Shirt number={number} size="normal" label={name} />
      <div className="ld-rank-main">
        <span className="ld-eyebrow">YOUR RANK · {def.label.toUpperCase()}</span>
        <span className="ld-rank-line"><b className="ld-rank-big">{card.rankText}</b> <span className="muted">of {card.of}{card.tied ? ", tied" : ""}</span></span>
      </div>
      <div className="ld-rank-fig"><b>{card.valueText}</b><small className="muted">{def.label}</small></div>
      <p className="ld-sr">{card.sentence}</p>
    </section>
  );
}

export function Podium({ rows, def, valueOf, communityId }: { rows: BoardRow[]; def: StatDef; valueOf: (r: BoardRow) => string; communityId: string }) {
  if (!rows.length) return null;
  // Visual order is 2nd, 1st, 3rd; the reading order (and the list under it) stays 1st, 2nd, 3rd.
  const order = [rows[1], rows[0], rows[2]].filter((r): r is BoardRow => !!r);
  return (
    <ol className="ld-podium" aria-label={`Top ${rows.length} for ${def.label}`}>
      {order.map((r) => {
        const first = r === rows[0];
        return (
          <li key={r.userId} className={`ld-pod${first ? " first" : ""}`} value={r.rank ?? undefined}>
            <span className="ld-eyebrow">{ordinal(r.rank!).toUpperCase()}{r.tied ? " · TIED" : ""}</span>
            <Shirt number={r.number} size="normal" />
            <Link href={`/c/${communityId}/players/${r.userId}`} className="ld-pod-name"><b>{r.name}</b></Link>
            <b className="ld-pod-val">{valueOf(r)}</b>
          </li>
        );
      })}
    </ol>
  );
}

export function RuleNote({ def }: { def: StatDef }) {
  if (!def.rule) return null;
  return (
    <div className="ld-note" role="note">
      <IconInfo size={18} />
      <span><b>{def.rule}.</b> Members below this are listed last and greyed, never hidden.</span>
    </div>
  );
}
