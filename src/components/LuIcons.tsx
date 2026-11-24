// Small line icons for Pick lineups and Correct a ball. Decoration only: every icon sits next to a word.
const PATHS = {
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></>,
  userplus: <><circle cx="9.5" cy="8.5" r="3.5" /><path d="M3 20c0-3.4 2.9-6 6.5-6s6.5 2.6 6.5 6M19 8v6M16 11h6" /></>,
  alert: <><path d="M12 4L2.8 19.5h18.4L12 4Z" /><path d="M12 10v4.5M12 17.2v.1" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8v.1" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  list: <path d="M8.5 6.5H20M8.5 12H20M8.5 17.5H20M4 6.5h.1M4 12h.1M4 17.5h.1" />,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4.2" /><circle cx="12" cy="12" r="0.8" /></>,
  pencil: <path d="M4 20l1-4L16.5 4.5a2 2 0 0 1 2.8 0l.2.2a2 2 0 0 1 0 2.8L8 19l-4 1Z" />,
  history: <><path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v4.5h4.5" /><path d="M12 8v4.2l2.8 1.6" /></>,
} satisfies Record<string, React.ReactNode>;

export type LuIconName = keyof typeof PATHS;

export default function LuIcon({ name, size = 18 }: { name: LuIconName; size?: number }) {
  return (
    <svg className="lu-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}
