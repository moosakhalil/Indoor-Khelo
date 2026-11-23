import pg from "pg";
import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")]; }));
const c = new pg.Client({ connectionString: env.DATABASE_URL });
await c.connect();
const mode = process.argv[2];
const one = async (q) => (await c.query(q)).rows;

console.log("--- BEFORE ---");
console.log("communities", await one("select id, name from community order by created_at"));
console.log("users", await one("select id, name from app_user order by created_at"));
console.log("counts", (await one(`select (select count(*) from community) communities, (select count(*) from app_user) users, (select count(*) from cricket_match) matches,
  (select count(*) from match_event) events, (select count(*) from booking) bookings, (select count(*) from venue) venues, (select count(*) from series) series,
  (select count(*) from audit_log) audit, (select count(*) from team) teams, (select count(*) from app_alert) alerts`))[0]);

if (mode === "delete") {
  // only rows my tests made: names that start with TEST, and the placeholder name left by account-deletion tests
  const a = await c.query("delete from community where name like 'TEST %' or name like 'TEST%'");
  const b = await c.query("delete from app_user where name like 'TEST %' or name = 'Deleted player'");
  // log lines whose person no longer exists (tests wrote them)
  const d = await c.query("delete from audit_log where actor_id is not null and actor_id not in (select id from app_user)");
  console.log("deleted communities", a.rowCount, "users", b.rowCount, "audit lines", d.rowCount);
  console.log("--- AFTER ---");
  console.log("communities", await one("select id, name from community order by created_at"));
  console.log("users", await one("select id, name from app_user order by created_at"));
  console.log("counts", (await one(`select (select count(*) from community) communities, (select count(*) from app_user) users, (select count(*) from cricket_match) matches,
    (select count(*) from match_event) events, (select count(*) from booking) bookings, (select count(*) from venue) venues, (select count(*) from series) series,
    (select count(*) from audit_log) audit, (select count(*) from team) teams, (select count(*) from app_alert) alerts`))[0]);
}
await c.end();
