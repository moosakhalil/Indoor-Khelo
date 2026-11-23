// The analytics loader's queries run against the real database (no data is created or changed).
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { pool } from "@/lib/db";
import { loadCommunityStates } from "@/lib/analyticsData";

describe.skipIf(!process.env.DATABASE_URL)("analytics loader", () => {
  afterAll(async () => { await pool.end(); });
  it("a community with no finished matches gives an empty list, with or without date filters", async () => {
    const id = randomUUID();
    expect(await loadCommunityStates(id)).toEqual([]);
    expect(await loadCommunityStates(id, { from: "2026-01-01", to: "2026-12-31" })).toEqual([]);
    expect(await loadCommunityStates(id, { from: "not-a-date", to: "also-not" })).toEqual([]);   // a bad date is ignored, never sent to the database
  });
});
