// Phase UI leftovers L2: the community name in the Match PDF header and the QR box ("Open the report online").
// The QR code is drawn with plain rectangles from the module matrix (no images, no new packages).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { PDFDocument } from "pdf-lib";
import QRCode from "qrcode";
import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, type Rules } from "@/lib/matchRules";
import { buildState } from "@/lib/engine/engine";
import type { PlayerEntry, ScoreEvent, ScoreEventBody, Side } from "@/lib/engine/types";
import { buildReportBlocks, qrRuns, renderReportPdf, type Block } from "./reportPdf";

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
const abandoned = () => run([start(6), ...innings(A, B, first.slice(0, 3), [A(3)]), { type: "match_end", payload: { kind: "abandoned" } }]);
const meta = (overs: number, venue = "Clifton Indoor Arena") => ({ dateText: "Sat 22 Nov, 8:00 pm", venue, overs, createdBy: "Ali Raza", scorers: [{ name: "Scorer", balls: 86 }] });

/** The decoded content streams of a pdf-lib file (deflated; text is hex in `<..> Tj`). */
function streams(bytes: Uint8Array): string[] {
  const raw = Buffer.from(bytes).toString("latin1");
  const out: string[] = [];
  for (const m of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    try { out.push(inflateSync(Buffer.from(m[1]!, "latin1")).toString("latin1")); } catch { /* not a content stream */ }
  }
  return out;
}
const pdfText = (bytes: Uint8Array) => streams(bytes).map((s) => [...s.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)].map((h) => Buffer.from(h[1]!, "hex").toString("latin1")).join("\n")).join("\n");
/** pdf-lib draws a rectangle as a filled path. Rectangles filled with pure black (`0 0 0 rg`) are the QR modules: nothing else uses that colour. */
const blackRects = (bytes: Uint8Array) => streams(bytes).reduce((n, s) => n + [...s.matchAll(/\b0 0 0 rg\b/g)].length, 0);
const pageCount = async (b: Uint8Array) => (await PDFDocument.load(b)).getPageCount();

const LINK = "https://indoor-khelo.example.com/r/AbCdEfGhIjKlMnOpQrStUvWxYz012345";
const scratch = process.env.L2_OUT;
const keep = (name: string, bytes: Uint8Array) => { if (scratch) { mkdirSync(scratch, { recursive: true }); writeFileSync(`${scratch}/${name}`, bytes); } };

describe("the QR box", () => {
  it("the runs rebuild exactly the module matrix of QRCode.create (error correction M), so the drawn code is the real one", () => {
    const { size, runs } = qrRuns(LINK);
    const modules = QRCode.create(LINK, { errorCorrectionLevel: "M" }).modules;
    expect(size).toBe(modules.size);
    const grid = Array.from({ length: size }, () => new Array<number>(size).fill(0));
    for (const r of runs) for (let k = 0; k < r.len; k++) grid[r.row]![r.col + k] = 1;
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) expect(grid[r]![c]).toBe(modules.get(r, c) ? 1 : 0);
    expect(runs.length).toBeGreaterThan(100);
  });

  it("is in the blocks only when a report link is given, with the proposal's words", () => {
    const withLink = buildReportBlocks(win(), { ...meta(6), reportUrl: LINK }, { full: false });
    const qr = withLink.find((b) => b.t === "qr") as Extract<Block, { t: "qr" }>;
    expect(qr).toMatchObject({ url: LINK, title: "Open the report online", text: "Scan to read the full ball-by-ball record." });
    for (const none of [undefined, null, ""]) expect(buildReportBlocks(win(), { ...meta(6), reportUrl: none }, { full: false }).some((b) => b.t === "qr")).toBe(false);
    expect(buildReportBlocks(win(), meta(6), { full: true }).some((b) => b.t === "qr")).toBe(false);
  });

  it("draws the modules as black rectangles, prints the title, caption and link, and the PDF stays valid A4", async () => {
    const withLink = await renderReportPdf(buildReportBlocks(win(), { ...meta(6), reportUrl: LINK }, { full: false }), { title: "TS v DF" });
    const without = await renderReportPdf(buildReportBlocks(win(), meta(6), { full: false }), { title: "TS v DF" });
    keep("short_with_qr.pdf", withLink);
    const doc = await PDFDocument.load(withLink);
    doc.getPages().forEach((p) => expect(p.getSize()).toEqual({ width: 595.28, height: 841.89 }));
    expect(blackRects(withLink)).toBe(qrRuns(LINK).runs.length);
    expect(blackRects(without)).toBe(0);
    const t = pdfText(withLink);
    expect(t).toContain("Open the report online");
    expect(t).toContain("Scan to read the full ball-by-ball record.");
    expect(t).toContain("https://indoor-khelo.example.com/r/");
    expect(pdfText(without)).not.toContain("Open the report online");
    // it sits after the changes list
    expect(t.indexOf("Open the report online")).toBeGreaterThan(t.indexOf("Nothing was changed."));
  });

  it("one QR module is at least 1.2 mm on paper and the whole code fits the page width, quiet zone included", async () => {
    const bytes = await renderReportPdf(buildReportBlocks(win(), { ...meta(6), reportUrl: LINK }, { full: false }));
    const s = streams(bytes).join("\n");
    // each module run is the path `0 0 m`, `0 H l`, `W H l`: H is the module plus a 0.1 pt overlap so rows leave no hairline gap
    const heights = [...s.matchAll(/0 0 0 rg[\s\S]*?0 0 m\s*0 ([\d.]+) l/g)].map((m) => Number(m[1]) - 0.1);
    expect(heights.length).toBe(qrRuns(LINK).runs.length);
    expect((Math.min(...heights) * 25.4) / 72).toBeGreaterThanOrEqual(1.2);
    expect((qrRuns(LINK).size + 8) * 3.5).toBeLessThan(595.28 - 80);
  });

  it("a long link still draws exactly its own modules, and the Full version keeps the code", async () => {
    const long = `https://indoor-khelo.example.com/r/${"a".repeat(40)}?x=${"b".repeat(60)}`;
    const bytes = await renderReportPdf(buildReportBlocks(win(), { ...meta(6), reportUrl: long }, { full: true }));
    expect(await pageCount(bytes)).toBeGreaterThanOrEqual(4);
    expect(blackRects(bytes)).toBe(qrRuns(long).runs.length);
  });

  it("without a link the page count is as before; the box needs about 160 pt, so a last page that is already full gets one more page, never more", async () => {
    const m = win();
    expect(await pageCount(await renderReportPdf(buildReportBlocks(m, meta(6), { full: false })))).toBe(2);
    expect(await pageCount(await renderReportPdf(buildReportBlocks(m, { ...meta(6), reportUrl: LINK }, { full: false })))).toBe(3);
    const a = abandoned();
    const without = await pageCount(await renderReportPdf(buildReportBlocks(a, meta(6), { full: false })));
    expect(await pageCount(await renderReportPdf(buildReportBlocks(a, { ...meta(6), reportUrl: LINK }, { full: false })))).toBeLessThanOrEqual(without + 1);
  });
});

describe("the community name in the header", () => {
  const head = (name: string | null | undefined, full = false) => renderReportPdf(buildReportBlocks(win(), { ...meta(6), communityName: name }, { full }));

  it("goes into the title block (trimmed) and is printed after the app name on page 1", async () => {
    const t = buildReportBlocks(win(), { ...meta(6), communityName: "  Karachi Indoor Cricket Club " }, { full: false })[0] as Extract<Block, { t: "title" }>;
    expect(t.community).toBe("Karachi Indoor Cricket Club");
    const bytes = await head("Karachi Indoor Cricket Club");
    keep("short_with_community.pdf", bytes);
    expect(pdfText(bytes)).toContain("Indoor Khelo · Karachi Indoor Cricket Club");
  });

  it("without a name (the public PDF, or a blank name) the header is the app name alone, as before", async () => {
    for (const none of [undefined, null, "", "   "]) {
      const t = buildReportBlocks(win(), { ...meta(6), communityName: none }, { full: false })[0] as Extract<Block, { t: "title" }>;
      expect(t.community).toBeUndefined();
      expect(pdfText(await head(none))).not.toContain("·");
    }
  });

  it("goes through sanitize: other scripts print as ?, accents stay, and a very long name is cut", async () => {
    const t1 = pdfText(await head("كراتشي Club José"));
    expect(t1).toContain("Indoor Khelo · ?????? Club José");
    const line = pdfText(await head("X".repeat(200))).split("\n").find((l) => l.startsWith("Indoor Khelo · X"))!;
    expect(line.endsWith("...")).toBe(true);
    expect(line.length).toBeLessThan(120);
  });

  it("is only on page 1; later pages keep the slim header", async () => {
    const bytes = await head("Karachi Indoor Cricket Club", true);
    expect((await pageCount(bytes))).toBeGreaterThan(2);
    expect(pdfText(bytes).split("Karachi Indoor Cricket Club").length - 1).toBe(1);
  });
});

describe("the public PDF rule (it shows nothing new)", () => {
  it("the public report page shows no community name today, so the public PDF route passes none; it passes only the link back to itself", () => {
    const page = readFileSync("src/app/r/[token]/page.tsx", "utf8");
    expect(page).not.toMatch(/community(Name|\.name)|getCommunity/);
    const pub = readFileSync("src/app/r/[token]/pdf/route.ts", "utf8");
    expect(pub).not.toMatch(/communityName|getCommunity/);
    expect(pub).toContain("reportUrl: `${await getOrigin()}/r/${token}`");
  });

  it("the member route passes the community name and the link only when the share token exists", () => {
    const mem = readFileSync("src/app/api/matches/[matchId]/pdf/route.ts", "utf8");
    expect(mem).toContain("communityName: community?.name ?? null");
    expect(mem).toContain("reportUrl: token ? `${origin}/r/${token}` : null");
  });
});
