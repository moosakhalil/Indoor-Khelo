import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Frame from "@/components/Frame";
import Shirt from "@/components/Shirt";
import { removeMemberAction, resetNumberAction, setRoleAction } from "@/app/actions2";
import { getMembership, isUuid, requireAdmin } from "@/lib/community";
import { one } from "@/lib/db";
import { requireAcceptedUser } from "@/lib/session";

export const metadata: Metadata = { title: "Manage member" };

const ERRORS: Record<string, string> = {
  is_admin: "This person is an Admin. Take Admin away first, then you can remove them.",
  is_self: "You cannot remove yourself here. Use Leave community on the Community page.",
  last_admin: "A community must always have at least one Admin. Make someone else Admin first.",
  not_found: "That person is no longer an approved member.",
  forbidden: "Only an Admin can do that.",
  no_change: "Nothing changed.",
};

// Admin only. Each risky action asks for one extra tap ("Yes, ...") before it happens.
export default async function ManageMemberPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; userId: string }>;
  searchParams: Promise<{ error?: string; done?: string }>;
}) {
  const { id, userId } = await params;
  const { error, done } = await searchParams;
  if (!isUuid(userId)) notFound();
  const me = await requireAcceptedUser();
  await requireAdmin(id, me.id);
  const m = await getMembership(id, userId);
  if (!m || m.status !== "approved") notFound();
  const person = await one<{ name: string }>("select name from app_user where id = $1", [userId]);
  const isSelf = userId === me.id;
  const name = person?.name ?? "Member";

  const hidden = (
    <>
      <input type="hidden" name="communityId" value={id} />
      <input type="hidden" name="userId" value={userId} />
    </>
  );

  return (
    <Frame communityId={id} title="Manage member" back={`/c/${id}/members`}>
      <div className="stack">
        <section className="card center">
          <div style={{ display: "flex", justifyContent: "center" }}><Shirt number={m.player_number} size="big" /></div>
          <h2 style={{ marginTop: 8 }}>{name}{isSelf ? " (you)" : ""}</h2>
          <p className="muted small" style={{ margin: "2px 0 0" }}>{m.role === "admin" ? "Admin" : "Member"} · {m.player_number === null ? "has not chosen a number yet" : `number ${m.player_number}`}</p>
        </section>

        {error && <div className="banner red" role="alert">{ERRORS[error] ?? "That did not work."}</div>}
        {done === "number" && <div className="banner green" role="status">{name} must choose a new number before using the community again.</div>}

        <section className="card">
          <b>{m.role === "admin" ? "Admin" : "Make Admin"}</b>
          <p className="muted small" style={{ margin: "4px 0 10px" }}>
            {m.role === "admin" ? "Admins can approve people, change settings and manage members. There must always be one." : "Admins can approve people, change settings and manage members."}
          </p>
          <form action={setRoleAction}>
            {hidden}
            <input type="hidden" name="role" value={m.role === "admin" ? "member" : "admin"} />
            <button className="btn ghost small">{m.role === "admin" ? "Take Admin away" : "Make Admin"}</button>
          </form>
        </section>

        {m.player_number !== null && (
          <section className="card">
            <b>Ask for a new number</b>
            <p className="muted small" style={{ margin: "4px 0 10px" }}>Use this to settle a dispute. The number is freed and {name} must pick a new one.</p>
            <details>
              <summary className="btn ghost small" style={{ listStyle: "none", cursor: "pointer" }}>Ask {name} to choose a new number…</summary>
              <form action={resetNumberAction} style={{ marginTop: 10 }}>
                {hidden}
                <button className="btn red small">Yes, free number {m.player_number}</button>
              </form>
            </details>
          </section>
        )}

        {!isSelf && (
          <section className="card">
            <b>Remove from community</b>
            <p className="muted small" style={{ margin: "4px 0 10px" }}>Their number is freed. Their stats stay with them and past scorecards keep their name. They can ask to join again.</p>
            <details>
              <summary className="btn red small" style={{ listStyle: "none", cursor: "pointer" }}>Remove {name}…</summary>
              <form action={removeMemberAction} style={{ marginTop: 10 }}>
                {hidden}
                <button className="btn red small">Yes, remove {name}</button>
              </form>
            </details>
          </section>
        )}
      </div>
    </Frame>
  );
}
