// The player is shown as a gold cricket shirt with their player number on the front.
// A guest, or a person still waiting for approval, gets a grey shirt with a dash.

type Props = { number?: number | null; size?: "small" | "normal" | "big"; label?: string };

export default function Shirt({ number, size = "normal", label }: Props) {
  const none = number === null || number === undefined;
  const body = none ? "#8A97B5" : "#F5C84B";
  const text = none ? "–" : String(number);
  const fontSize = text.length > 1 ? 15 : 17;
  return (
    <svg
      className={`shirt${size === "big" ? " big" : size === "small" ? " small" : ""}`}
      viewBox="0 0 48 48"
      role="img"
      aria-label={label ?? (none ? "No player number" : `Player number ${number}`)}
    >
      <path d="M16 6L10 9L3 17L9 22L13 19V43H35V19L39 22L45 17L38 9L32 6C30 10 18 10 16 6Z" fill={body} />
      <path d="M13 11L10 9L3 17L9 22L13 19Z" fill="#0B1020" stroke={body} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M35 11L38 9L45 17L39 22L35 19Z" fill="#0B1020" stroke={body} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M17 6C19 11 29 11 31 6L28.5 5C26.5 8 21.5 8 19.5 5Z" fill="#0B1020" />
      <text x="24" y="33" textAnchor="middle" fontSize={fontSize} fill="#0B1020">{text}</text>
    </svg>
  );
}
