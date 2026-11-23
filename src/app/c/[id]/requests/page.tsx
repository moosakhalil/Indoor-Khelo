import type { Metadata } from "next";
import Shirt from "@/components/Shirt";
import Frame from "@/components/Frame";
import { decideRequestAction } from "@/app/actions";
import { listPending, requireAdmin } from "@/lib/community";
import { requireAcceptedUser } from "@/lib/session";

export const metadata: Metadata = { title: "Join requests" };

export default async function RequestsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAcceptedUser();
  await requireAdmin(id, user.id); // only the Admin can open this, checked on the server
  const pending = await listPending(id);
  return (
    <Frame communityId={id} title="Join requests" back={`/c/${id}`} right={pending.length ? <span className="chip gold">{pending.length}</span> : null}>
      {pending.length === 0 ? (
        <div className="card center muted">No one is waiting. New requests appear here.</div>
      ) : (
        <div className="stack">
          {pending.map((p) => (
            <section key={p.user_id} className="card">
              <div className="row">
                <Shirt number={null} label="Number chosen after approval" />
                <span className="t grow"><b>{p.name}</b><br /><small className="muted">Number chosen after approval</small></span>
              </div>
              <div className="two" style={{ marginTop: 10 }}>
                <form action={decideRequestAction}>
                  <input type="hidden" name="communityId" value={id} />
                  <input type="hidden" name="userId" value={p.user_id} />
                  <input type="hidden" name="decision" value="approve" />
                  <button className="btn gold small" style={{ width: "100%" }}>Approve</button>
                </form>
                <form action={decideRequestAction}>
                  <input type="hidden" name="communityId" value={id} />
                  <input type="hidden" name="userId" value={p.user_id} />
                  <input type="hidden" name="decision" value="reject" />
                  <button className="btn ghost small" style={{ width: "100%" }}>Reject</button>
                </form>
              </div>
            </section>
          ))}
          <p className="muted small" style={{ margin: "4px 2px" }}>People you approve must choose their own player number before they get in. Rejected people can ask again later.</p>
        </div>
      )}
    </Frame>
  );
}
