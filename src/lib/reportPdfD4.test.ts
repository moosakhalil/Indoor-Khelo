// Phase D4 (UI redesign): the redesigned match PDF. Teams with badges and scores, result banner, worm chart, Player of the Match
// callout, shaded tables, over-by-over columns, ball-by-ball bubbles, page header and page numbers.
import { inflateSync } from "node:zlib";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, type Rules } from "@/lib/matchRules";
import { buildState } from "@/lib/engine/engine";
import type { PlayerEntry, ScoreEvent, ScoreEventBody, Side } from "@/lib/engine/types";
import { teamColor } from "@/components/TeamBadge";
import { buildReportBlocks, renderReportPdf, type Block } from "./reportPdf";

const A = (i: number) => `a${i}`;
const B = (i: number) => `b${i}`;
const players = (an: string[], bn: string[], guests: string[] = []): PlayerEntry[] => [
  ...an.map((n, i) => ({ id: A(i + 1), side: 1 as Side, name: n, number: i + 1, kind: guests.includes(A(i + 1)) ? ("guest" as const) : ("member" as const), userId: guests.includes(A(i + 1)) ? null : `ua${i}` })),
  ...bn.map((n, i) => ({ id: B(i + 1), side: 2 as Side, name: n, number: i + 11, kind: guests.includes(B(i + 1)) ? ("guest" as const) : ("member" as const), userId: guests.includes(B(i + 1)) ? null : `ub${i}` })),
];
const ball = (p: object): ScoreEventBody => ({ type: "ball", payload: p } as ScoreEventBody);
const run = (bodies: ScoreEventBody[]) => {
  const r = buildState(bodies.map((b, i) => ({ ...b, id: `e${i + 1}`, seq: i + 1, by: "Scorer" }) as ScoreEvent));
  if (!r.ok) throw new Error(`refused at ${r.at}: ${r.error}`);
  return r.state;
};
const AN = ["Ali Raza", "Zain Malik", "Bilal Ahmed", "Usman Tariq", "Faizan Ali", "Daniyal Shah"];
const BN = ["Shahzaib Khan", "Adnan Siddiqui", "Kamran Baig", "Rizwan Aslam", "Yasir Farooq", "Imran Javed"];
const start = (overs: number, an = AN, bn = BN, guests: string[] = [], sides: [string, string] = ["Thunder Strikers", "Desert Falcons"], rules: Partial<Rules> = {}): ScoreEventBody => ({
  type: "match_start", payload: { sides, overs, playersPerSide: 6, rules: { ...DEFAULT_RULES, ...rules }, players: players(an, bn, guests), toss: { winner: 1, decision: "bat" }, battingFirst: 1 },
});
function innings(bat: (i: number) => string, bowl: (i: number) => string, overs: (string | number)[][], nextIn: string[]): ScoreEventBody[] {
  const out: ScoreEventBody[] = [{ type: "innings_start", payload: { striker: bat(1), nonStriker: bat(2), bowler: bowl(1) } }];
  let k = 0;
  overs.forEach((ov, oi) => {
    for (const b of ov) {
      if (b === "W") { out.push(ball({ wicket: { type: "bowled" } })); out.push({ type: "batter_in", payload: { player: nextIn[k++]!, end: "striker" } }); }
      else if (b === "wd") out.push(ball({ extra: "wide" }));
      else out.push(ball({ runs: b as number }));
    }
    if (oi < overs.length - 1) out.push({ type: "bowler", payload: { player: bowl(((oi + 1) % 3) + 1) } });
  });
  return out;
}
const first = [[1, 4, 6, 0, 1, 1], [2, 6, 4, 1, 0, "W"], [1, 1, 4, 0, 6, 2], [0, 4, 1, 1, 6, 4], [4, 1, 6, 0, "wd", 1, 2], [6, 1, 4, 4, 1, 0]];
const second = [[1, 0, 4, "W", 2, 1], [0, 6, 1, 4, 0, 1], [4, 1, "W", 2, 0, 1], [1, 6, 0, 4, 1, 1], [0, 1, 4, 1, 6, 1], [1, 4, 0, "W", 1, 6]];
const win = () => run([start(6, AN, BN, [B(6)]), ...innings(A, B, first, [A(3), A(4), A(5)]), ...innings(B, A, second, [B(3), B(4), B(5), B(6)]), { type: "finish", payload: {} }]);
const tie = () => run([
  start(2, AN, BN, [B(5), B(6)], ["Thunder Strikers", "Desert Falcons"], { superOver: "never" }),
  ...innings(A, B, [[1, 1, 1, 1, 1, 1], [3, 3, 0, 0, 0, 0]], []), ...innings(B, A, [[2, 2, 2, 0, 0, 0], [1, 1, 1, 1, 1, 1]], []), { type: "finish", payload: {} },
]);
const abandoned = () => run([start(6), ...innings(A, B, first.slice(0, 3), [A(3)]), { type: "match_end", payload: { kind: "abandoned" } }]);
const meta = (overs: number, venue = "Clifton Indoor Arena") => ({ dateText: "Sat 22 Nov, 8:00 pm", venue, overs, createdBy: "Ali Raza", scorers: [{ name: "Scorer", balls: 86 }] });

/** All the text drawn in a PDF made by pdf-lib with standard fonts (content streams are deflated, text is hex in `<..> Tj`). */
function pdfText(bytes: Uint8Array): string {
  const raw = Buffer.from(bytes).toString("latin1");
  let out = "";
  for (const m of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let s: string;
    try { s = inflateSync(Buffer.from(m[1]!, "latin1")).toString("latin1"); } catch { continue; }
    for (const h of s.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) out += Buffer.from(h[1]!, "hex").toString("latin1") + "\n";
  }
  return out;
}
const pageCount = async (b: Uint8Array) => (await PDFDocument.load(b)).getPageCount();

describe("the header of the report: teams, scores and the result banner", () => {
  it("a win marks the winner and carries the result in a gold banner", () => {
    const b = buildReportBlocks(win(), meta(6), { full: false })[0] as Extract<Block, { t: "title" }>;
    expect(b.teams!.map((t) => t.name)).toEqual(["Thunder Strikers", "Desert Falcons"]);
    expect(b.teams!.map((t) => t.won)).toEqual([true, false]);
    expect(b.teams![0]).toMatchObject({ score: "87/1", overs: "6.0 ov", note: "Batted first" });
    expect(b.teams![1]!.note).toBe("Chased 88");
    expect(b.banner).toEqual({ tone: "win", text: "Thunder Strikers won by 21 runs" });
    expect(b.version).toBe("Short report");
  });
  it("a tie has no winner and a blue banner; an abandoned match says so in a red one and the side that never batted shows a dash", () => {
    const t = buildReportBlocks(tie(), meta(2), { full: false })[0] as Extract<Block, { t: "title" }>;
    expect(t.teams!.every((x) => !x.won)).toBe(true);
    expect(t.banner).toMatchObject({ tone: "tie", text: expect.stringContaining("tied") });
    const a = buildReportBlocks(abandoned(), meta(6), { full: true })[0] as Extract<Block, { t: "title" }>;
    expect(a.banner).toEqual({ tone: "abandoned", text: "Match abandoned" });
    expect(a.teams![1]).toMatchObject({ score: "-", note: "Did not bat" });
    expect(a.version).toBe("Full report");
  });
  it("the Player of the Match is a callout with chips for the points, and an abandoned match gets a calm box", () => {
    const c = buildReportBlocks(win(), meta(6), { full: false }).find((b) => b.t === "callout") as Extract<Block, { t: "callout" }>;
    expect(c.tone).toBe("gold");
    expect(c.items[0]!.chips!.length).toBeGreaterThan(2);
    expect(c.items[0]!.text).toMatch(/: \d+ points$/);
    const calm = buildReportBlocks(abandoned(), meta(6), { full: false }).find((b) => b.t === "callout") as Extract<Block, { t: "callout" }>;
    expect(calm).toMatchObject({ tone: "calm", items: [], notes: ["An abandoned match has no Player of the Match."] });
  });
  it("the worm chart has a series per innings that batted, ending on the final score, and the key numbers are there", () => {
    const g = buildReportBlocks(win(), meta(6), { full: false }).find((b) => b.t === "glance") as Extract<Block, { t: "glance" }>;
    expect(g.series).toHaveLength(2);
    expect(g.series[0]!.points.at(-1)!.y).toBe(87);
    expect(g.series[1]!.points.at(-1)!.y).toBe(66);
    expect(g.series[0]!.wickets).toHaveLength(1);
    expect(g.tiles.map((t) => t.label)).toEqual(["Fours", "Sixes", "Dot balls", "Extras"]);
  });
});

describe("ball by ball in the full version", () => {
  const full = buildReportBlocks(win(), meta(6), { full: true });
  const rows = full.filter((b): b is Extract<Block, { t: "bullets" }> => b.t === "bullets" && !!b.overs);
  it("one row per over with the balls as bubbles, and every ball is still in the data", () => {
    expect(rows).toHaveLength(2);
    expect(rows[0]!.overs).toHaveLength(6);
    expect(rows[0]!.overs![0]).toMatchObject({ over: 1, runs: 13, wickets: 0 });
    expect(rows[0]!.overs![0]!.balls.map((b) => b.label)).toEqual(["1", "4", "6", "0", "1", "1"]);
    expect(rows[0]!.overs![0]!.balls.map((b) => b.kind)).toEqual(["run", "four", "six", "dot", "run", "run"]);
    expect(rows[0]!.items).toHaveLength(win().innings[0]!.balls.length);
  });
  it("every ball keeps its full sentence (batter and bowler named) under its over, as before the redesign", () => {
    const o = rows[0]!.overs!;
    expect(o[0]!.notes).toHaveLength(o[0]!.balls.length);
    expect(o[0]!.notes.every((n) => n.includes(" to "))).toBe(true);
    expect(o[1]!.wickets).toBe(1);
    expect(o[1]!.notes).toHaveLength(o[1]!.balls.length);
    expect(o[1]!.notes.some((n) => n.includes("WICKET"))).toBe(true);
    expect(o[1]!.balls.at(-1)).toMatchObject({ label: "W", kind: "wicket" });
    const wide = rows[0]!.overs![4]!.balls.find((b) => b.kind === "extra");
    expect(wide?.label).toBe("Wd");
  });
  it("the short version has no ball-by-ball rows", () => {
    expect(buildReportBlocks(win(), meta(6), { full: false }).some((b) => b.t === "bullets" && !!b.overs)).toBe(false);
  });
});

describe("the PDF file", () => {
  it("a normal 6 over match is two pages short, four pages full (every ball sentence is printed), every page numbered of N, with the footer and version", async () => {
    const m = win();
    const short = await renderReportPdf(buildReportBlocks(m, meta(6), { full: false }), { title: "TS v DF" });
    const full = await renderReportPdf(buildReportBlocks(m, meta(6), { full: true }), { title: "TS v DF" });
    expect(await pageCount(short)).toBe(2);
    expect(await pageCount(full)).toBe(4);
    const t = pdfText(short);
    expect(t).toContain("Page 1 of 2");
    expect(t).toContain("Page 2 of 2");
    expect(t).toContain("Scored with Indoor Khelo  |  Short report");
    expect(pdfText(full)).toContain("Scored with Indoor Khelo  |  Full report");
    expect(pdfText(full)).toContain("Page 4 of 4");
    expect(pdfText(full)).toContain("Ov 6");
    expect(t).not.toContain("Ov 6");
  });
  it("draws the team badges with the initials of both teams on page 1 and again in the header of the later pages", async () => {
    const t = pdfText(await renderReportPdf(buildReportBlocks(win(), meta(6), { full: false })));
    expect((t.match(/^TS$/gm) ?? []).length).toBeGreaterThanOrEqual(4);      // page 1 row, worm legend, innings header, page 2 header
    expect((t.match(/^DF$/gm) ?? []).length).toBeGreaterThanOrEqual(4);
    expect(t).toContain("IK");
    expect(t).toContain("WON");
    expect(t).toContain("Thunder Strikers v Desert Falcons");
    expect(teamColor("Thunder Strikers")).toEqual(teamColor("  thunder   strikers "));       // the badge colour is the app's, from the name
  });
  it("tied and abandoned matches render, with their banner words and no WON mark", async () => {
    const tt = pdfText(await renderReportPdf(buildReportBlocks(tie(), meta(2), { full: false })));
    expect(tt).toContain("Match tied");
    expect(tt).not.toContain("WON");
    const at = pdfText(await renderReportPdf(buildReportBlocks(abandoned(), meta(6), { full: false })));
    expect(at).toContain("Match abandoned");
    expect(at).toContain("no Player of the Match");
    expect(at).toContain("Did not bat");
  });
  it("a guest gets a small GUEST tag in the tables", async () => {
    const g = run([start(6, AN, BN, [A(2)]), ...innings(A, B, first, [A(3), A(4), A(5)]), ...innings(B, A, second, [B(3), B(4), B(5), B(6)]), { type: "finish", payload: {} }]);
    expect(pdfText(await renderReportPdf(buildReportBlocks(g, meta(6), { full: false })))).toContain("GUEST");
    expect(pdfText(await renderReportPdf(buildReportBlocks(win(), meta(6), { full: false })))).not.toContain("GUEST");
  });
  it("letters the standard fonts lack print as ? and very long names are cut, never crash", async () => {
    const odd = run([
      start(6, ["علی رضا", "Hamza 😀 The Great", "Muhammad ".repeat(10).trim(), "W".repeat(60), "José Müller", "Ñandú Çelik"], BN, [A(2)], ["Thunder Strikers of the Great Northern Indoor Cricket League Division Two", "Désert Fálcons"]),
      ...innings(A, B, first, [A(3), A(4), A(5)]), ...innings(B, A, second, [B(3), B(4), B(5), B(6)]), { type: "finish", payload: {} },
    ]);
    const bytes = await renderReportPdf(buildReportBlocks(odd, meta(6, "A very long venue name ".repeat(8)), { full: true }));
    const t = pdfText(bytes);
    expect(t).toContain("??? ???");
    expect(t).toContain("Hamza ? The Great");
    expect(t).toContain("José Müller");
    expect(t).not.toMatch(/[؀-ۿ]/);
    expect(await pageCount(bytes)).toBeGreaterThan(1);
  });
  it("a 20 over full match fits a few pages; a table that breaks across pages repeats its header on each", async () => {
    const ov = (n: number) => Array.from({ length: n }, (_, o) => [1, 0, 4, o % 5 === 4 ? 6 : 1, 0, 2]);
    const long = run([start(20), ...innings(A, B, ov(20), []), ...innings(B, A, Array.from({ length: 20 }, (_, o) => [0, 1, 0, o % 4 === 3 ? 4 : 0, 2, 0]), []), { type: "finish", payload: {} }]);
    const bytes = await renderReportPdf(buildReportBlocks(long, meta(20), { full: true }));
    const n = await pageCount(bytes);
    expect(n).toBeGreaterThanOrEqual(3);
    expect(n).toBeLessThanOrEqual(9);
    expect(pdfText(bytes)).toContain(`Page ${n} of ${n}`);
    const rows = Array.from({ length: 120 }, (_, i) => [`Player ${i + 1}`, "not out", String(i), "5", "0", "0", "100.0"]);
    const many = await renderReportPdf([
      { t: "title", text: "Many rows" },
      { t: "table", head: ["Batter", "How out", "R", "B", "4s", "6s", "SR"], widths: [3, 4, 1, 1, 1, 1, 1.4], align: ["l", "l", "r", "r", "r", "r", "r"], twoLine: true, rows },
    ]);
    const pages = await pageCount(many);
    expect(pages).toBeGreaterThanOrEqual(3);
    expect((pdfText(many).match(/^BATTER$/gm) ?? []).length).toBe(pages);       // one header per page
  });
  it("is a valid A4 PDF with the title in its properties", async () => {
    const bytes = await renderReportPdf(buildReportBlocks(win(), meta(6), { full: true }), { title: "Thunder Strikers v Desert Falcons" });
    expect(Buffer.from(bytes.slice(0, 5)).toString("latin1")).toBe("%PDF-");
    expect(Buffer.from(bytes.slice(-8)).toString("latin1")).toContain("%%EOF");
    const d = await PDFDocument.load(bytes);
    expect(d.getTitle()).toBe("Thunder Strikers v Desert Falcons");
    expect(d.getPages().every((p) => p.getWidth() === 595.28 && p.getHeight() === 841.89)).toBe(true);
  });
});
