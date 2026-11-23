// Phase 5: the scoring engine's shapes. The whole match is an ordered list of events. Everything on screen (score, overs,
// scorecards) is worked out from that list by one pure function, the same on the phone (offline) and on the server.
import type { BowlerLimit, Rules } from "@/lib/matchRules";

export type Side = 1 | 2;

/** One person in the match. A member or a guest; the id is the lineup entry id (match_player.id). */
export type PlayerEntry = { id: string; side: Side; name: string; number: number | null; kind: "member" | "guest"; userId: string | null };

export type ExtraKind = "wide" | "noball" | "bye" | "legbye";
export const BALL_DISMISSALS = ["bowled", "caught", "lbw", "stumped", "hit_wicket", "run_out"] as const;
export type BallDismissal = (typeof BALL_DISMISSALS)[number];
export type DismissalType = BallDismissal | "retired_out";
/** Wickets the bowler is credited with. A run-out and a retirement are not the bowler's. */
export const BOWLER_WICKETS: readonly string[] = ["bowled", "caught", "lbw", "stumped", "hit_wicket"];

export type BallPayload = {
  /** Runs off this ball: the bat (plain, no ball), byes, leg-byes, extra runs run on a wide, or runs completed before a run-out. */
  runs?: number;
  extra?: ExtraKind | null;
  wicket?: { type: BallDismissal; out?: string | null; fielder?: string | null; newEnd?: "striker" | "nonStriker" | null } | null;
};

export type RetireKind = "retired_out" | "retired_hurt" | "absent" | "replaced";

export type StartPayload = {
  sides: [string, string];
  overs: number;
  playersPerSide: number;
  rules: Rules;
  players: PlayerEntry[];
  toss: { winner: Side; decision: "bat" | "bowl" } | null;
  battingFirst: Side;
};

export type ScoreEventBody =
  | { type: "match_start"; payload: StartPayload }
  | { type: "innings_start"; payload: { striker: string; nonStriker: string | null; bowler: string } }
  | { type: "ball"; payload: BallPayload }
  | { type: "batter_in"; payload: { player: string; end?: "striker" | "nonStriker" | null } }
  | { type: "bowler"; payload: { player: string } }
  | { type: "swap_strike"; payload: Record<string, never> }
  | { type: "set_crease"; payload: { striker: string; nonStriker: string | null } }
  | { type: "batting_order"; payload: { order: string[] } }
  | { type: "player_added"; payload: { player: PlayerEntry } }
  | { type: "retire"; payload: { player: string; kind: RetireKind; replacedBy?: string | null } }
  | { type: "substitute"; payload: { side: Side; name: string } }
  | { type: "overs_change"; payload: { overs: number; scope: "innings" | "remaining" } }
  | { type: "players_change"; payload: { playersPerSide: number } }
  | { type: "limit_change"; payload: { limit: BowlerLimit } }
  | { type: "penalty"; payload: { runs: number } }
  | { type: "target_manual"; payload: { target: number | null } }
  | { type: "innings_end"; payload: Record<string, never> }
  | { type: "super_over_decision"; payload: { play: boolean } }
  | { type: "match_end"; payload: { kind: "abandoned" | "result"; winner?: Side | null } }
  | { type: "finish"; payload: Record<string, never> }
  | { type: "pause"; payload: Record<string, never> }
  | { type: "resume"; payload: Record<string, never> }
  | { type: "undo"; payload: Record<string, never> }
  | { type: "edit"; payload: { target: string; patch: BallPayload } };

export type ScoreEventType = ScoreEventBody["type"];
export type ScoreEvent = ScoreEventBody & {
  id: string;            // made on the device, so a repeat can be ignored
  seq: number;           // 1, 2, 3 ... with no gaps
  reason?: string;       // optional note on a change
  by?: string;           // who made it (filled in by the server)
  at?: string;           // when (device clock)
};

/* ---------- what the engine works out ---------- */
export type Dismissal = { type: DismissalType; bowler: string | null; fielder: string | null };
export type BatterStatus = "batting" | "out" | "retired_hurt" | "absent" | "replaced";
export type BatterLine = {
  id: string; runs: number; balls: number; fours: number; sixes: number;
  status: BatterStatus; dismissal: Dismissal | null; order: number;
};
export type BowlerLine = { id: string; legalBalls: number; runs: number; wickets: number; wides: number; noballs: number; maidens: number };
export type BallRecord = {
  eventId: string; over: number; ball: number; label: string; teamRuns: number; counted: boolean;
  bowler: string; striker: string; wicket: boolean; text: string;
  // everything the statistics need, kept with the ball
  nonStriker: string | null;
  extra: ExtraKind | null;
  runs: number;            // runs as entered (bat runs, byes, wide extras, runs completed)
  batRuns: number;         // credited to the batter
  charged: number;         // charged to the bowler
  freeHit: boolean;        // this ball was bowled as a free hit
  wicketType: DismissalType | null;
  out: string | null;      // who was dismissed
  fielder: string | null;
};
export type FallOfWicket = { n: number; runs: number; over: string; player: string };
export type TimelineEntry = { at: string; text: string; by?: string };

export type InningsState = {
  index: number;
  superOver: boolean;
  batting: Side;
  bowling: Side;
  runs: number;
  wickets: number;
  legalBalls: number;
  extras: { wide: number; noball: number; bye: number; legbye: number; penalty: number };
  maxOvers: number;
  target: number | null;
  manualTarget: number | null;
  batters: Record<string, BatterLine>;
  battingOrderHint: string[];
  striker: string | null;
  nonStriker: string | null;
  vacant: "striker" | "nonStriker" | null;
  needBatter: boolean;
  needBowler: boolean;
  bowler: string | null;
  lastOverBowler: string | null;
  bowlers: Record<string, BowlerLine>;
  overBalls: BallRecord[];
  balls: BallRecord[];
  freeHit: boolean;
  fow: FallOfWicket[];
  partnership: { runs: number; balls: number };
  ended: boolean;
  endReason: "overs" | "allout" | "target" | "declared" | null;
  /** Internal bookkeeping for maidens and the over in progress. */
  overRunsCharged: number;
  overBowlers: string[];
};

export type MatchResult = {
  kind: "win" | "tie" | "no_result" | "abandoned" | "innings";
  winner: Side | null;
  margin: { type: "runs" | "wickets"; n: number } | null;
  text: string;
};

export type MatchPhase = "not_started" | "need_innings" | "scoring" | "level_prompt" | "result" | "finished" | "abandoned";

export type MatchState = {
  started: boolean;
  sides: [string, string];
  rules: Rules;
  overs: number;
  playersPerSide: number;
  limit: BowlerLimit;
  toss: StartPayload["toss"];
  battingFirst: Side;
  players: Record<string, PlayerEntry>;
  /** Players taken out of the match for good (absent or replaced). */
  gone: Record<string, "absent" | "replaced">;
  innings: InningsState[];
  phase: MatchPhase;
  paused: boolean;
  /** Which innings is next (0 first innings, 1 second, 2 first super over, ...) */
  nextInnings: number;
  superOverPlaying: boolean;
  result: MatchResult | null;
  timeline: TimelineEntry[];
  eventCount: number;
};

export type BuildResult = { ok: true; state: MatchState; effective: ScoreEvent[] } | { ok: false; error: string; at: number; effective: ScoreEvent[] };
