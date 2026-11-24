// Pure helpers for the Alerts screen: what each alert kind looks like, the filters, and the day headers.
// No database and no React here, so they are easy to test.

export type AlertGroup = "match" | "payment" | "other";
export type AlertTone = "gold" | "orange" | "blue" | "red" | "green" | "mute";
export type AlertIconName = "calendar" | "bell" | "swap" | "clock" | "x" | "wallet" | "coin";

export type KindMeta = { label: string; icon: AlertIconName; tone: AlertTone; group: AlertGroup };

/** Every `kind` the code writes into app_alert (see lib/matches.ts and lib/bookings.ts). */
export const ALERT_KINDS: Record<string, KindMeta> = {
  match_scheduled: { label: "New match", icon: "calendar", tone: "gold", group: "match" },
  match_reminder: { label: "Reminder", icon: "bell", tone: "orange", group: "match" },
  match_changed: { label: "Changed", icon: "swap", tone: "blue", group: "match" },
  match_postponed: { label: "Postponed", icon: "clock", tone: "orange", group: "match" },
  match_cancelled: { label: "Cancelled", icon: "x", tone: "red", group: "match" },
  booking_share: { label: "Payments", icon: "wallet", tone: "green", group: "payment" },
  booking_changed: { label: "Cost changed", icon: "swap", tone: "blue", group: "payment" },
  payment_reminder: { label: "Payment reminder", icon: "coin", tone: "orange", group: "payment" },
};

const OTHER: KindMeta = { label: "Alert", icon: "bell", tone: "mute", group: "other" };

export function kindMeta(kind: string): KindMeta {
  return ALERT_KINDS[kind] ?? OTHER;
}

export const ANSWERABLE_KINDS = ["match_scheduled", "match_reminder"] as const;
export const canAnswerKind = (kind: string) => (ANSWERABLE_KINDS as readonly string[]).includes(kind);

export type AlertFilter = "all" | "unread" | "matches" | "payments";
export const FILTERS: { key: AlertFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "matches", label: "Matches" },
  { key: "payments", label: "Payments" },
];

export function matchesFilter(a: { kind: string; read: boolean }, f: AlertFilter): boolean {
  switch (f) {
    case "all": return true;
    case "unread": return !a.read;
    case "matches": return kindMeta(a.kind).group === "match";
    case "payments": return kindMeta(a.kind).group === "payment";
  }
}

export type DayBucket = "today" | "yesterday" | "earlier";
export const DAY_LABEL: Record<DayBucket, string> = { today: "Today", yesterday: "Yesterday", earlier: "Earlier" };

/** The calendar day of an instant in a time zone, as a day number. */
function dayNumber(d: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const g = (k: string) => Number(parts.find((p) => p.type === k)!.value);
  return Math.round(Date.UTC(g("year"), g("month") - 1, g("day")) / 86400000);
}

/** Today / Yesterday / Earlier, by the viewer's own calendar days. */
export function dayBucket(created: Date, now: Date, tz: string): DayBucket {
  const diff = dayNumber(now, tz) - dayNumber(created, tz);
  if (diff <= 0) return "today";
  if (diff === 1) return "yesterday";
  return "earlier";
}

/** "6:10 pm" for today and yesterday, "Thu 19 Nov" for earlier days. */
export function alertTimeLabel(created: Date, bucket: DayBucket, tz: string): string {
  if (bucket === "earlier") return new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short" }).format(created);
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true }).format(created);
}

/** Counts for the filter chips. */
export function filterCounts(list: { kind: string; read: boolean }[]) {
  return {
    all: list.length,
    unread: list.filter((a) => !a.read).length,
    matches: list.filter((a) => matchesFilter(a, "matches")).length,
    payments: list.filter((a) => matchesFilter(a, "payments")).length,
  };
}

/** How many alerts of each kind, known kinds first in a fixed order. */
export function countsByKind(list: { kind: string }[]): { kind: string; label: string; n: number }[] {
  const order = [...Object.keys(ALERT_KINDS), "other"];
  const tally = new Map<string, number>();
  for (const a of list) {
    const k = ALERT_KINDS[a.kind] ? a.kind : "other";
    tally.set(k, (tally.get(k) ?? 0) + 1);
  }
  return order.filter((k) => tally.has(k)).map((k) => ({ kind: k, label: kindMeta(k).label, n: tally.get(k)! }));
}

export const alertsMarkedText = (n: number) => `${n} alert${n === 1 ? "" : "s"} marked as read`;

export const ALERTS_TRUTH = "Alerts show inside the app. Phone push notifications are not switched on.";
export const ALERTS_KEEP = "Only the latest 50 alerts are kept; older ones drop off this list.";
