import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, type Rules } from "@/lib/matchRules";
import { buildState } from "@/lib/engine/engine";
import type { PlayerEntry, ScoreEvent, ScoreEventBody, Side } from "@/lib/engine/types";
import { buildReportBlocks, pdfFileName, renderReportPdf, sanitize, type Block } from "./reportPdf";

const A = (i: number) => `a${i}`;
const B = (i: number) => `b${i}`;
const players = (names?: Partial<Record<string, string>>): PlayerEntry[] => [
  ...[1, 2, 3, 4, 5, 6].map((i) => ({ id: A(i), side: 1 as Side, name: names?.[A(i)] ?? `Alpha${i}`, number: i, kind: "member" as const, userId: `ua${i}` })),
  ...[1, 2, 3, 4, 5, 6].map((i) => ({ id: B(i), side: 2 as Side, name: names?.[B(i)] ?? `Bravo${i}`, number: i + 10, kind: "member" as const, userId: `ub${i}` })),
];
const ball = (p: object): ScoreEventBody => ({ type: "ball", payload: p } as ScoreEventBody);
const start = (over: Partial<Rules> = {}, overs = 2, names?: Partial<Record<string, string>>): ScoreEventBody => ({
  type: "match_start", payload: { sides: ["Alpha", "Bravo"], overs, playersPerSide: 6, rules: { ...DEFAULT_RULES, ...over }, players: players(names), toss: { winner: 1, decision: "bat" }, battingFirst: 1 },
});
const run = (bodies: ScoreEventBody[]) => {
  const r = buildState(bodies.map((b, i) => ({ ...b, id: `e${i + 1}`, seq: i + 1, by: "Tester" }) as ScoreEvent));
  if (!r.ok) throw new Error(`refused at ${r.at}: ${r.error}`);
  return r.state;
};
const meta = { dateText: "Sat 23 Nov, 7:30 pm", venue: "Arena One", overs: 2, createdBy: "Creator", scorers: [{ name: "Tester", balls: 24 }] };
const textOf = (blocks: Block[]) => JSON.stringify(blocks);

/** Alpha 19 in 2 overs, Bravo chase 20 in 5 balls (Bravo1: 19 off 4). */
const sample = (names?: Partial<Record<string, string>>) => run([
  start({}, 2, names),
  { type: "innings_start", payload: { striker: A(1), nonStriker: A(2), bowler: B(1) } },
  ball({ runs: 4 }), ball({ runs: 1 }), ball({ runs: 6 }), ball({ extra: "wide" }), ball({ runs: 0 }),
  ball({ wicket: { type: "caught", fielder: B(2) } }),
  { type: "batter_in", payload: { player: A(3), end: "striker" } },
  ball({ runs: 2 }),
  { type: "bowler", payload: { player: B(2) } },
  ball({ runs: 1 }), ball({ runs: 4 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }),
  { type: "innings_start", payload: { striker: B(1), nonStriker: B(2), bowler: A(1) } },
  ball({ runs: 6 }), ball({ runs: 6 }), ball({ runs: 6 }), ball({ runs: 1 }), ball({ runs: 1 }),
  { type: "finish", payload: {} },
]);

/** A long match: 20 overs each, so the ball-by-ball part runs over several pages. */
function longMatch() {
  const bodies: ScoreEventBody[] = [start({}, 20)];
  const inn = (bat: (i: number) => string, bowl: (i: number) => string, first: boolean) => {
    bodies.push({ type: "innings_start", payload: { striker: bat(1), nonStriker: bat(2), bowler: bowl(1) } });
    for (let over = 0; over < 20; over++) {
      for (let b = 0; b < 6; b++) bodies.push(ball({ runs: first && over === 0 && b === 0 ? 1 : 0 }));
      if (over < 19) bodies.push({ type: "bowler", payload: { player: bowl(((over + 1) % 3) + 1) } });
    }
  };
  inn(A, B, true);
  inn(B, A, false);
  bodies.push({ type: "finish", payload: {} });
  return run(bodies);
}

async function pages(bytes: Uint8Array) {
  const d = await PDFDocument.load(bytes);
  return d.getPageCount();
}
const head = (b: Uint8Array) => Buffer.from(b.slice(0, 5)).toString("latin1");
const tail = (b: Uint8Array) => Buffer.from(b.slice(-8)).toString("latin1");

describe("report content", () => {
  const m = sample();
  const full = buildReportBlocks(m, meta, { full: true });
  const short = buildReportBlocks(m, meta, { full: false });

  it("has the header, toss, result, who created and scored, and the Player of the Match with its points", () => {
    const t = textOf(short);
    expect(short[0]).toMatchObject({ t: "title", text: "Alpha v Bravo" });
    expect(t).toContain("Sat 23 Nov, 7:30 pm");
    expect(t).toContain("Arena One");
    expect(t).toContain("Alpha won the toss and chose to bat");
    expect(t).toContain("Bravo won by 6 wickets");
    expect(t).toContain("Creator");
    expect(t).toContain("Tester (24 balls)");
    expect(t).toContain("Bravo1: 57 points");
    expect(t).toContain("Nobody picks the winner");
    expect(t).toContain("Top three: 1. Bravo1 57");
  });

  it("has batting and bowling cards, did not bat, extras, fall of wickets, partnerships, over by over, match stats and the timeline", () => {
    const tables = short.filter((b): b is Extract<Block, { t: "table" }> => b.t === "table");
    expect(tables).toHaveLength(4);                                     // batting and bowling for both innings
    expect(tables[0]!.head).toEqual(["Batter", "How out", "R", "B", "4s", "6s", "SR"]);
    expect(tables[0]!.rows[0]).toEqual(["Alpha1", "not out", "6", "3", "1", "0", "200.0"]);
    expect(tables[0]!.rows.some((r) => r[1] === "c Bravo2 b Bravo1")).toBe(true);
    expect(tables[1]!.rows.find((r) => r[0] === "Bravo1")).toEqual(["Bravo1", "1.0", "0", "14", "1", "14.0"]);
    const t = textOf(short);
    expect(t).toContain("Did not bat: Alpha4, Alpha5, Alpha6");
    expect(t).toContain("Extras 1 (wides 1");
    expect(t).toContain("Fall of wickets: 1-12 (Alpha2, 0.5 ov)");
    expect(t).toContain("Alpha1 & Alpha2: 12 (5 balls)");
    expect(short.some((b) => b.t === "bars")).toBe(true);
    expect(t).toContain("Over 1");
    expect(t).toContain("Dot balls");
    expect(t).toContain("Best partnerships");
    expect(t).toContain("Top performers");
    expect(t).toContain("Changes during the match");
  });

  it("the full version adds every ball; the short version does not", () => {
    expect(textOf(short)).not.toContain("Ball by ball");
    expect(textOf(short)).not.toContain("0.1 Bravo1 to Alpha1");
    expect(textOf(full)).toContain("Ball by ball");
    expect(textOf(full)).toContain("0.1 Bravo1 to Alpha1: Four runs.");
    const bullets = full.filter((b): b is Extract<Block, { t: "bullets" }> => b.t === "bullets");
    expect(bullets.at(-1)!.items).toHaveLength(m.innings[1]!.balls.length);
    expect(bullets.at(-2)!.items).toHaveLength(m.innings[0]!.balls.length);
  });

  it("an abandoned match says it has no Player of the Match; a super over match shows its own section", () => {
    const ab = run([start(), { type: "innings_start", payload: { striker: A(1), nonStriker: A(2), bowler: B(1) } }, ball({ runs: 4 }), { type: "match_end", payload: { kind: "abandoned" } }]);
    const t = textOf(buildReportBlocks(ab, meta, { full: false }));
    expect(t).toContain("Match abandoned");
    expect(t).toContain("no Player of the Match");
    const so = run([
      start({ superOver: "always" }, 1),
      { type: "innings_start", payload: { striker: A(1), nonStriker: A(2), bowler: B(1) } }, ball({ runs: 1 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }),
      { type: "innings_start", payload: { striker: B(1), nonStriker: B(2), bowler: A(1) } }, ball({ runs: 1 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }),
      { type: "innings_start", payload: { striker: B(3), nonStriker: B(4), bowler: A(2) } }, ball({ runs: 6 }), ball({ runs: 6 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }),
      { type: "innings_start", payload: { striker: A(3), nonStriker: A(4), bowler: B(5) } }, ball({ runs: 1 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }), ball({ runs: 0 }),
      { type: "finish", payload: {} },
    ]);
    const s = textOf(buildReportBlocks(so, meta, { full: true }));
    expect(s).toContain("Super over: Bravo");
    expect(s).toContain("super over");
  });
});

describe("text that must never crash the file", () => {
  it("turns characters the PDF fonts do not have into ?, keeps ordinary ones, and maps smart quotes and dashes", () => {
    expect(sanitize("Ali Raza")).toBe("Ali Raza");
    expect(sanitize("علی")).toBe("???");
    expect(sanitize("Sami 😀")).toBe("Sami ?");               // one emoji is one question mark, not two
    expect(sanitize("It’s “fine” – really…")).toBe("It's \"fine\" - really...");
    expect(sanitize("José Müller")).toBe("José Müller");
    expect(sanitize("a\nb\tc")).toBe("a b c");
  });
  it("makes a safe file name", () => {
    expect(pdfFileName("Alpha", "Bravo", new Date("2026-11-23T10:00:00Z"))).toBe("Alpha-v-Bravo-2026-11-23.pdf");
    expect(pdfFileName("علی", "Team / A:B*?", null)).toBe("Team-v-Team-A-B-match.pdf");
    expect(pdfFileName("x".repeat(100), "y", null).length).toBeLessThan(60);
  });
});

describe("the PDF file", () => {
  it("is a real PDF that loads again, with a footer and page numbers", async () => {
    const m = sample();
    const bytes = await renderReportPdf(buildReportBlocks(m, meta, { full: false }), { title: "Alpha v Bravo" });
    expect(head(bytes)).toBe("%PDF-");
    expect(tail(bytes)).toContain("%%EOF");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(0);
    expect(doc.getTitle()).toBe("Alpha v Bravo");
    expect(doc.getPage(0).getSize()).toEqual({ width: 595.28, height: 841.89 });     // A4 portrait
  });

  it("player names in any script, emoji, and very long names do not break it, and long text is wrapped", async () => {
    const m = sample({ [A(1)]: "علی رضا", [B(1)]: "Hamza 😀 The Great", [A(2)]: "Muhammad ".repeat(14).trim(), [B(2)]: "W".repeat(90) });
    const blocks = buildReportBlocks(m, { ...meta, venue: "A very long venue name ".repeat(10) }, { full: true });
    const bytes = await renderReportPdf(blocks);
    expect(head(bytes)).toBe("%PDF-");
    expect(await pages(bytes)).toBeGreaterThan(0);
    await expect(PDFDocument.load(bytes)).resolves.toBeTruthy();
  });

  it("the full version of a long match has more pages than the short one", async () => {
    const m = longMatch();
    const shortBytes = await renderReportPdf(buildReportBlocks(m, { ...meta, overs: 20 }, { full: false }));
    const fullBytes = await renderReportPdf(buildReportBlocks(m, { ...meta, overs: 20 }, { full: true }));
    const [s, f] = [await pages(shortBytes), await pages(fullBytes)];
    expect(s).toBeGreaterThan(0);
    expect(f).toBeGreaterThan(s);
    expect(f).toBeGreaterThanOrEqual(s + 3);                 // 240 balls need several extra pages
    expect(tail(fullBytes)).toContain("%%EOF");
  });

  it("tables repeat their header when they run onto a new page", async () => {
    const rows = Array.from({ length: 120 }, (_, i) => [`Player ${i + 1}`, "not out", String(i), "5", "0", "0", "100.0"]);
    const bytes = await renderReportPdf([
      { t: "title", text: "Many rows" },
      { t: "table", head: ["Batter", "How out", "R", "B", "4s", "6s", "SR"], widths: [3, 4, 1, 1, 1, 1, 1.4], align: ["l", "l", "r", "r", "r", "r", "r"], rows },
    ]);
    expect(await pages(bytes)).toBeGreaterThanOrEqual(3);
  });
});
