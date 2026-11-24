// Phase G2: line icons for Waiting, Number picker, Player numbers, Leave and Delete community.
// Always decorative: every button or message that carries one also has words.
const paths = {
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4.5 20c1-4 4-6 7.5-6s6.5 2 7.5 6" /></>,
  users: <><circle cx="9" cy="8.5" r="3.5" /><path d="M2.5 19.5c.8-3.4 3.2-5 6.5-5s5.7 1.6 6.5 5M16 5.2a3.4 3.4 0 010 6.6M18 14.8c1.9.6 3 2.2 3.5 4.7" /></>,
  refresh: <><path d="M19.5 12a7.5 7.5 0 01-13 5.1M4.5 12a7.5 7.5 0 0113-5.1" /><path d="M17.5 3v4h-4M6.5 21v-4h4" /></>,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8v.1" /></>,
  warn: <><path d="M12 3.5l9.5 16.5h-19z" /><path d="M12 10v4.5M12 17.4v.1" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="9.5" rx="2.5" /><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" /></>,
  trash: <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6" />,
  shield: <path d="M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6z" />,
  stats: <path d="M5 20V12M10 20V6M15 20v-9M20 20V9" />,
  list: <path d="M8 6h12M8 12h12M8 18h12M4 6v.1M4 12v.1M4 18v.1" />,
  swap: <path d="M4 8h14l-3-3M20 16H6l3 3" />,
  rejoin: <><circle cx="10" cy="8" r="4" /><path d="M3 20c1-4 3.5-6 7-6M18 8v6M15 11h6" /></>,
  trophy: <path d="M8 4h8v5a4 4 0 01-8 0zM8 6H4.5v1.5A3.5 3.5 0 008 11M16 6h3.5v1.5A3.5 3.5 0 0116 11M12 13v4M8.5 20h7M10 17h4" />,
  wallet: <><rect x="3.5" y="6" width="17" height="13" rx="2.5" /><path d="M3.5 10h17M16 14.5h.1" /></>,
  grid: <><rect x="4" y="4" width="6.5" height="6.5" rx="1.2" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2" /></>,
  chevron: <path d="M9 5l7 7-7 7" />,
} as const;

export type CnIconName = keyof typeof paths;

export default function CnIc({ name }: { name: CnIconName }) {
  return (
    <svg className="cn-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  );
}
