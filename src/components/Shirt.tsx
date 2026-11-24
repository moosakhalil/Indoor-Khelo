import { initials } from "@/lib/validation";

// The player is shown as a gold cricket shirt with their player number on the front.
// A guest, or a person still waiting for approval, gets a grey shirt with a dash.
//
// Sizes (decided 2026-11-24):
//   big    96px  number on the chest and, when `name` is given, two initials under it
//   normal 48px  number only, for list rows where the full name sits beside the shirt
//   small  36px  number only, for score chips and tight rows
// Two digits use a smaller font on normal and small so they never touch the sleeves.

export type ShirtSize = "small" | "normal" | "big";
// `hideNumber` is for the public profile page only: the number is private there, so the shirt is gold with
// the two initials on the chest and no number (decided 2026-11-24). Only used with size="big" and a name.
type Props = { number?: number | null; size?: ShirtSize; label?: string; name?: string; hideNumber?: boolean };

/** Font sizes and baselines (in the 48 x 48 drawing) for every case. Exported so tests can pin them. */
export function shirtLayout(size: ShirtSize, digits: number, withInitials: boolean) {
  if (size === "big" && withInitials) {
    return { numberSize: digits > 1 ? 14 : 16.5, numberY: 31, initialsSize: 7.2, initialsY: 40 };
  }
  if (size === "big") return { numberSize: digits > 1 ? 15 : 18, numberY: 33, initialsSize: 0, initialsY: 0 };
  return { numberSize: digits > 1 ? 12.5 : 16, numberY: 33, initialsSize: 0, initialsY: 0 };
}

export default function Shirt({ number, size = "normal", label, name, hideNumber }: Props) {
  if (hideNumber && size === "big" && name && name.trim().length > 0) {
    const letters = initials(name);
    return (
      <svg className="shirt big" viewBox="0 0 48 48" role="img" aria-label={label ?? `Player ${letters}`}>
        <path d="M16 6L10 9L3 17L9 22L13 19V43H35V19L39 22L45 17L38 9L32 6C30 10 18 10 16 6Z" fill="#F5C84B" />
        <path d="M13 11L10 9L3 17L9 22L13 19Z" fill="#0B1020" stroke="#F5C84B" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M35 11L38 9L45 17L39 22L35 19Z" fill="#0B1020" stroke="#F5C84B" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M17 6C19 11 29 11 31 6L28.5 5C26.5 8 21.5 8 19.5 5Z" fill="#0B1020" />
        <text className="shirt-ini" x="24" y="32" textAnchor="middle" fontSize="13" letterSpacing="0.8" fill="#0B1020">{letters}</text>
      </svg>
    );
  }
  const none = number === null || number === undefined;
  const body = none ? "#8A97B5" : "#F5C84B";
  const text = none ? "–" : String(number);
  const showInitials = size === "big" && !!name && name.trim().length > 0;
  const letters = showInitials ? initials(name as string) : "";
  const lay = shirtLayout(size, text.length, showInitials);
  const aria = label ?? (none ? "No player number" : `Player number ${number}`);
  return (
    <svg
      className={`shirt${size === "big" ? " big" : size === "small" ? " small" : ""}`}
      viewBox="0 0 48 48"
      role="img"
      aria-label={showInitials && label === undefined ? `${aria}, ${letters}` : aria}
    >
      <path d="M16 6L10 9L3 17L9 22L13 19V43H35V19L39 22L45 17L38 9L32 6C30 10 18 10 16 6Z" fill={body} />
      <path d="M13 11L10 9L3 17L9 22L13 19Z" fill="#0B1020" stroke={body} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M35 11L38 9L45 17L39 22L35 19Z" fill="#0B1020" stroke={body} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M17 6C19 11 29 11 31 6L28.5 5C26.5 8 21.5 8 19.5 5Z" fill="#0B1020" />
      <text className="shirt-num" x="24" y={lay.numberY} textAnchor="middle" fontSize={lay.numberSize} fill="#0B1020">{text}</text>
      {showInitials && (
        <text className="shirt-ini" x="24" y={lay.initialsY} textAnchor="middle" fontSize={lay.initialsSize} letterSpacing="0.6" fill="#0B1020">{letters}</text>
      )}
    </svg>
  );
}
