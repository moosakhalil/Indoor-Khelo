// Phase D1: the top card of the Match details page. Both teams with their badges (the viewer's own team gets the gold ring),
// the status badge, the series chip, four fact tiles (when, venue, format, players per side), umpire, notes and who made it.
// Server-rendered, no state.
import Link from "next/link";
import { IconCalendar } from "@/components/B4Icons";
import { IconClock, IconPin } from "@/components/CrIcons";
import { IconUsers } from "@/components/B4Icons";
import { MdMic, MdTrophy } from "@/components/MdIcons";
import TeamBadge from "@/components/TeamBadge";
import { statusBadge } from "@/lib/md";
import { formatWhen, type MatchStatus } from "@/lib/matchRules";
import "./md.css";

export type HeroMatch = {
  status: MatchStatus; scheduled_at: Date | null; venue: string; overs: number; players_per_side: number; umpire: string; notes: string;
  side1_name: string; side2_name: string; created_by_name: string | null; changed_by_name: string | null; updated_at: Date; rematch_of: string | null;
};

function Fact({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return <div className="md-fact"><span className="md-fic" aria-hidden="true">{icon}</span><span className="md-ftx"><small>{label}</small><b>{children}</b></span></div>;
}

function HeroTeam({ name, own }: { name: string; own: boolean }) {
  return (
    <span className="md-team">
      <span className={own ? "md-own" : undefined}><TeamBadge name={name} size="lg" /></span>
      <b>{name}</b>
      {own && <small className="md-yours">Your team</small>}
    </span>
  );
}

export default function MatchHero({ communityId, matchId, m, tz, series, mine }: {
  communityId: string; matchId: string; m: HeroMatch; tz: string; series: { id: string; name: string } | null; mine: [boolean, boolean];
}) {
  const badge = statusBadge(m.status);
  const noDate = !m.scheduled_at;
  const canSet = m.status === "draft" || m.status === "scheduled" || m.status === "postponed";
  return (
    <section className="md-hero" aria-label="Match">
      <div className="md-herotop">
        {series ? <Link href={`/c/${communityId}/series/${series.id}`} className="md-series"><MdTrophy size={16} /><span>{series.name}</span><span aria-hidden="true">›</span><span className="md-sr">Series: {series.name}</span></Link> : <span />}
        <span className={`md-badge ${badge.tone}`}>{badge.label}</span>
      </div>
      <div className="md-teams">
        <HeroTeam name={m.side1_name} own={mine[0]} />
        <b aria-hidden="true" className="md-v">v</b>
        <HeroTeam name={m.side2_name} own={mine[1]} />
      </div>
      <div className="md-facts">
        <Fact icon={<IconCalendar size={18} />} label="When">
          {noDate ? <>No date yet{canSet && <> <Link href={`/c/${communityId}/matches/${matchId}/edit`} className="md-setdate">Set date</Link></>}</> : formatWhen(m.scheduled_at, tz)}
        </Fact>
        <Fact icon={<IconPin size={18} />} label="Venue">{m.venue || "Not set"}</Fact>
        <Fact icon={<IconClock size={18} />} label="Format">{m.overs} overs a side</Fact>
        <Fact icon={<IconUsers size={18} />} label="Players per side">{m.players_per_side}</Fact>
        {m.umpire && <Fact icon={<MdMic size={18} />} label="Umpire">{m.umpire}</Fact>}
      </div>
      {m.notes && <div className="md-notes"><small>Notes</small><p>{m.notes}</p></div>}
      <p className="md-made muted small">
        Created by <b>{m.created_by_name ?? "—"}</b> · Changed by <b>{m.changed_by_name ?? "—"}</b> ({formatWhen(m.updated_at, tz)})
        {m.rematch_of && <> · <Link href={`/c/${communityId}/matches/${m.rematch_of}`} className="md-under">Rematch of an earlier match</Link></>}
      </p>
    </section>
  );
}
