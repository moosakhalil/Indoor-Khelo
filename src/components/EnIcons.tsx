// Small inline line icons for the entry pages (Phase G1). Always decorative: a word sits next to each icon.
// Inline only (no network), so they also work with no signal.
const P: Record<string, React.ReactNode> = {
  pencil: <path d="M4 20l1-4L16 5l3 3L8 19l-4 1ZM14 7l3 3" />,
  chart: <path d="M5 20V10M12 20V4M19 20v-7" />,
  coin: <><circle cx="12" cy="12" r="9" /><path d="M14.5 9.5c-.6-.8-1.5-1.2-2.5-1.2-1.4 0-2.5.8-2.5 1.9 0 2.6 5.2 1.2 5.2 3.8 0 1.1-1.2 2-2.7 2-1.1 0-2-.5-2.7-1.3M12 6.5v1.8M12 15.7v1.8" /></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  warn: <path d="M12 4l9 16H3L12 4ZM12 10v4M12 17.2h.01" />,
  wifioff: <path d="M3 3l18 18M2 9a15 15 0 0 1 5-3M22 9a15 15 0 0 0-8-4M5.5 12.5a10 10 0 0 1 3-2M18.5 12.5a10 10 0 0 0-3-2M9 16a5 5 0 0 1 6 0M12 20h.01" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z" />,
  people: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20c0-4 3-6 6-6s6 2 6 6M15 14c3 0 6 2 6 6" /></>,
  person: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" /></>,
  pin: <><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  brokenlink: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1M4 4l3 3M20 20l-3-3M8 3v2M3 8h2M19 16h2M16 19v2" />,
  code: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><path d="M14 14h2v2h-2zM18 18h2M18 14h2" /></>,
  send: <path d="M21 3L3 10.5l7 2.5 2.5 7L21 3ZM10 13l11-10" />,
  userplus: <><circle cx="10" cy="8" r="3.5" /><path d="M3 20c0-4 3-6 7-6M18 9v6M15 12h6" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  right: <path d="M9 6l6 6-6 6" />,
  back: <path d="M15 6l-6 6 6 6" />,
  download: <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />,
  clipboard: <><rect x="6" y="5" width="12" height="16" rx="2" /><path d="M9 5a3 3 0 0 1 6 0v1H9V5Z" /></>,
  swap: <path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />,
  out: <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l4 4-4 4M19 12H9" />,
  cog: <><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /></>,
};

export type EnIconName = keyof typeof P;

export default function EnIcon({ name, size = 20 }: { name: EnIconName; size?: number }) {
  return (
    <svg className="en-ic" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {P[name]}
    </svg>
  );
}

/** A turning ring for buttons that are working. It stops turning when the person asks for reduced motion (see en.css). */
export function EnSpinner() {
  return <span className="en-spin" aria-hidden="true" />;
}
