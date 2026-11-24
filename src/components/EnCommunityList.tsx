import Link from "next/link";
import CommunityLogo from "@/components/CommunityLogo";
import EnIcon from "@/components/EnIcons";

export type EnMine = { id: string; name: string; role: "admin" | "member"; status: string; player_number: number | null };

/** "Admin · number 7", "Member · number 12", or "Request sent, waiting for the Admin" for a pending one. */
export function mineMeta(c: EnMine): string {
  if (c.status === "pending") return "Request sent, waiting for the Admin";
  return `${c.role === "admin" ? "Admin" : "Member"} · number ${c.player_number ?? "–"}`;
}

/** The "Your communities" card on /choose: logo, name, a text badge (Admin or Pending, never colour only), one line. */
export default function EnCommunityList({ mine }: { mine: EnMine[] }) {
  return (
    <section className="en-card en-comm" aria-labelledby="mine-h">
      <div className="en-card-head">
        <h2 id="mine-h">Your communities</h2>
        <span className="en-count" aria-label={`${mine.length} communities`}>{mine.length}</span>
      </div>
      <ul className="en-rows">
        {mine.map((c) => (
          <li key={c.id}>
            <Link href={c.status === "pending" ? `/c/${c.id}/waiting` : `/c/${c.id}`} className="en-row">
              <CommunityLogo name={c.name} />
              <span className="en-row-t"><b>{c.name}</b><small>{mineMeta(c)}</small></span>
              {c.status === "pending" ? <span className="en-badge pend">Pending</span> : c.role === "admin" ? <span className="en-badge admin">Admin</span> : null}
              <EnIcon name="right" size={18} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
