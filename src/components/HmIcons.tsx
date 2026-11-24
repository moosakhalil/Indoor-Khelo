// Small line icons for Home and the shell. Always decorative: the word next to each icon carries the meaning.
const P: Record<string, React.ReactNode> = {
  bell: <path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 8H4c0-1 2-2 2-8ZM10 20a2 2 0 0 0 4 0" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  pencil: <path d="M4 20l1-4L16 5l3 3L8 19l-4 1ZM14 7l3 3" />,
  plus: <path d="M12 5v14M5 12h14" />,
  userplus: <><circle cx="10" cy="8" r="3.5" /><path d="M3 20c0-4 3-6 7-6M18 9v6M15 12h6" /></>,
  people: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20c0-4 3-6 6-6s6 2 6 6M15 14c3 0 6 2 6 6" /></>,
  shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z" />,
  trophy: <path d="M8 4h8v5a4 4 0 0 1-8 0V4ZM8 6H4v1a3 3 0 0 0 4 3M16 6h4v1a3 3 0 0 1-4 3M12 13v4M8 20h8M10 17h4" />,
  chart: <path d="M5 20V10M12 20V4M19 20v-7" />,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.2" /></>,
  wifioff: <path d="M3 3l18 18M2 9a15 15 0 0 1 5-3M22 9a15 15 0 0 0-8-4M5.5 12.5a10 10 0 0 1 3-2M18.5 12.5a10 10 0 0 0-3-2M9 16a5 5 0 0 1 6 0M12 20h.01" />,
  list: <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />,
  coin: <><circle cx="12" cy="12" r="9" /><path d="M14.5 9.5c-.6-.8-1.5-1.2-2.5-1.2-1.4 0-2.5.8-2.5 1.9 0 2.6 5.2 1.2 5.2 3.8 0 1.1-1.2 2-2.7 2-1.1 0-2-.5-2.7-1.3M12 6.5v1.8M12 15.7v1.8" /></>,
  down: <path d="M6 9l6 6 6-6" />,
  right: <path d="M9 6l6 6-6 6" />,
  eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  swap: <path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />,
};

export type HmIconName = keyof typeof P;

export default function HmIcon({ name, size = 20 }: { name: HmIconName; size?: number }) {
  return (
    <svg className="hm-ic" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {P[name]}
    </svg>
  );
}
