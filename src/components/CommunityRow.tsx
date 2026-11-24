import Link from "next/link";
import CommunityLogo from "@/components/CommunityLogo";

// One community in a list: logo initials, name, my role and number, and a Switch button (or "Current").
// The same row is used in the top-bar switcher and on the Community page, so people recognise it.
export default function CommunityRow({
  id, name, role, number, members, current,
}: { id: string; name: string; role: "admin" | "member"; number: number | null; members?: number; current?: boolean }) {
  const meta = [role === "admin" ? "Admin" : "Member", number === null ? null : `#${number}`, members === undefined ? null : `${members} members`].filter(Boolean).join(" · ");
  const inner = (
    <>
      <CommunityLogo name={name} />
      <span className="t grow"><b>{name}</b><small className="muted">{meta}</small></span>
      {current ? <span className="chip gold">Current</span> : <span className="btn small ghost" aria-hidden="true">Switch</span>}
    </>
  );
  return current ? (
    <div className="crow current" aria-current="true">{inner}</div>
  ) : (
    <Link href={`/switch/${id}`} className="crow" aria-label={`Switch to ${name}`}>{inner}</Link>
  );
}
