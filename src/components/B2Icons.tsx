// Small line icons for the Alerts, Community and Invite screens. They are decoration: every one sits next to a word.
const PATHS: Record<string, React.ReactNode> = {
  calendar: <><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  bell: <><path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15L6 17Z" /><path d="M10 21h4" /></>,
  swap: <><path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  x: <><path d="M6 6l12 12M18 6L6 18" /></>,
  wallet: <><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10h18M16 14.5h2" /></>,
  coin: <><circle cx="12" cy="12" r="8.5" /><path d="M14.5 9.5c-.6-.8-1.5-1.2-2.5-1.2-1.4 0-2.4.7-2.4 1.8 0 2.6 5 1.2 5 3.8 0 1.1-1.1 1.9-2.6 1.9-1.1 0-2.1-.4-2.7-1.3M12 6.8v1.5M12 15.7v1.5" /></>,
  inbox: <><path d="M4 13l2.5-7.5h11L20 13v5.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5V13Z" /><path d="M4 13h4.5l1 2.5h5l1-2.5H20" /></>,
  cog: <><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" /></>,
  userplus: <><circle cx="9.5" cy="8.5" r="3.5" /><path d="M3 20c0-3.4 2.9-6 6.5-6s6.5 2.6 6.5 6M19 8v6M16 11h6" /></>,
  users: <><circle cx="9" cy="8.5" r="3.3" /><path d="M2.8 19.5c0-3.2 2.7-5.5 6.2-5.5s6.2 2.3 6.2 5.5M16 5.5a3.3 3.3 0 0 1 0 6.2M18 14.3c2.2.6 3.4 2.4 3.4 5.2" /></>,
  logout: <><path d="M10 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H10M15 8l4 4-4 4M19 12H9" /></>,
  shield: <><path d="M12 3l7 2.8v5.6c0 4.3-2.9 7.7-7 9.6-4.1-1.9-7-5.3-7-9.6V5.8L12 3Z" /></>,
  shieldoff: <><path d="M12 3l7 2.8v5.6c0 4.3-2.9 7.7-7 9.6-4.1-1.9-7-5.3-7-9.6V5.8L12 3Z" /><path d="M9 12h6" /></>,
  pencil: <><path d="M4 20l1-4L16.5 4.5a2 2 0 0 1 2.8 0l.2.2a2 2 0 0 1 0 2.8L8 19l-4 1Z" /></>,
  star: <><path d="M12 3.5l2.5 5.3 5.8.7-4.3 4 1.1 5.7L12 16.3 6.9 19.2 8 13.5l-4.3-4 5.8-.7L12 3.5Z" /></>,
  grid: <><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></>,
  pin: <><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.3" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>,
  globe: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.5 2.4 3.6 5.2 3.6 8.5s-1.1 6.1-3.6 8.5c-2.5-2.4-3.6-5.2-3.6-8.5s1.1-6.1 3.6-8.5Z" /></>,
  share: <><path d="M12 15V4M8 8l4-4 4 4M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13" /></>,
  copy: <><rect x="8.5" y="8.5" width="11" height="11" rx="2.2" /><path d="M15.5 8.5V6A1.5 1.5 0 0 0 14 4.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" /></>,
  check: <><path d="M5 12.5l4.5 4.5L19 7.5" /></>,
  refresh: <><path d="M19.5 12a7.5 7.5 0 0 1-13 5M4.5 12a7.5 7.5 0 0 1 13-5M17.5 3.5V7H14M6.5 20.5V17H10" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  chevron: <><path d="M9.5 6l6 6-6 6" /></>,
  home: <><path d="M4 11l8-7 8 7v8.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V11Z" /></>,
};

export type B2IconName = keyof typeof PATHS;

export default function Icon({ name, size = 20 }: { name: B2IconName | string; size?: number }) {
  return (
    <svg className="b2-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {PATHS[name] ?? PATHS.bell}
    </svg>
  );
}
