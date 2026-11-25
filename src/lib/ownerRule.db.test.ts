// "Option A" (decided 2026-11-25) against the real Neon database with temporary people: only the person who added a match, team, series,
// venue or booking, or an Admin, can cancel or delete it. Another member is refused and nothing changes. Payments are covered in bookings.db.test.ts.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { pool, query } from "@/lib/db";
import { chooseNumber, createCommunity, requestToJoin } from "@/lib/community";
import { createBooking, createVenue, deleteBooking, deleteVenue, getBooking, getVenue } from "@/lib/bookings";
import { DEFAULT_RULES } from "@/lib/matchRules";
import { cancelMatch, createMatch, deleteMatch, getMatch } from "@/lib/matches";
import { createSeries, deleteSeries, getSeries } from "@/lib/seriesDb";
import { createTeam, deleteTeam, getTeam } from "@/lib/teams";

const run = !!process.env.DATABASE_URL;
const users: string[] = [];
const communities: string[] = [];
async function newUser(label: string) {
  const id = randomUUID();
  users.push(id);
  await query("insert into app_user (id, name, terms_accepted_at) values ($1, $2, now())", [id, `TEST ${label}`]);
  return id;
}

describe.skipIf(!run)("who may cancel or delete: the person who added it, or an Admin", () => {
  afterAll(async () => {
    if (communities.length) await query("delete from community where id = any($1::uuid[])", [communities]);
    if (users.length) await query("delete from app_user where id = any($1::uuid[])", [users]);
    await pool.end();
  });

  it("another member is refused (nothing changes); the creator and an Admin are allowed", { timeout: 300_000 }, async () => {
    const admin = await newUser("owner admin");
    const id = await createCommunity(admin, { name: "TEST Owner Club", description: "", location: "", approvalRequired: false });
    communities.push(id);
    const code = (await query<{ invite_code: string }>("select invite_code from community where id = $1", [id]))[0]!.invite_code;
    await chooseNumber(admin, id, 1);
    const [a, b] = [await newUser("owner a"), await newUser("owner b")];
    for (const [u, n] of [[a, 10], [b, 11]] as const) { await requestToJoin(u, code); await chooseNumber(u, id, n); }

    // member A adds one of everything
    const team = (await createTeam(a, id, { name: "TEST Owner Team", description: "", captainId: null, viceCaptainId: null })).id!;
    const venue = (await createVenue(a, id, { name: "TEST Owner Hall", address: "", contact: "" })).id!;
    const booking = (await createBooking(a, id, { venueId: venue, startsAt: new Date(Date.now() + 3 * 86_400_000), durationMinutes: 60, totalCost: 3000, reference: "", notes: "" })).id!;
    const series = (await createSeries(a, id, {
      name: `TEST Owner Series ${randomUUID().slice(0, 6)}`, format: "open", bestOf: null, startsOn: null, endsOn: null, notes: "",
      sides: [{ name: "Alpha", teamId: null }, { name: "Bravo", teamId: null }],
    })).id!;
    const match = (await createMatch(a, id, {
      sides: [{ teamId: null, name: "Alpha" }, { teamId: null, name: "Bravo" }], scheduledAt: new Date(Date.now() + 3 * 86_400_000), venue: "", overs: 6, playersPerSide: 6,
      rules: DEFAULT_RULES, umpire: "", notes: "", warning: null,
    })).id!;

    // member B did not add them and is not an Admin: refused, and everything is still there
    expect(await deleteTeam(b, id, team)).toBe("not_owner");
    expect(await deleteVenue(b, id, venue)).toBe("not_owner");
    expect(await deleteBooking(b, id, booking)).toBe("not_owner");
    expect(await deleteSeries(b, id, series)).toBe("not_owner");
    expect(await cancelMatch(b, id, match)).toBe("not_owner");
    expect(await deleteMatch(b, id, match)).toBe("not_owner");
    expect(await getTeam(id, team)).not.toBeNull();
    expect(await getVenue(id, venue)).not.toBeNull();
    expect(await getBooking(id, booking)).not.toBeNull();
    expect(await getSeries(id, series)).not.toBeNull();
    expect((await getMatch(id, match, b))!.status).toBe("scheduled");

    // an Admin may delete someone else's team, and cancel and delete someone else's match
    expect(await deleteTeam(admin, id, team)).toBe("ok");
    expect(await cancelMatch(admin, id, match)).toBe("ok");
    expect(await deleteMatch(admin, id, match)).toBe("ok");

    // the creator may delete their own
    expect(await deleteBooking(a, id, booking)).toBe("ok");
    expect(await deleteVenue(a, id, venue)).toBe("ok");
    expect(await deleteSeries(a, id, series)).toBe("ok");
    expect(await getVenue(id, venue)).toBeNull();
  });
});
