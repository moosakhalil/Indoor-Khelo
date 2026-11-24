// Small inline line icons for Phase G3 (Account, You are offline, App banners, Public profile).
// Inline SVG only: nothing here is fetched, so the offline page and the banners keep working with no network.
// Always decoration: a word sits next to every one.
const PATHS: Record<string, React.ReactNode> = {
  back: <path d="M14.5 5.5L8 12l6.5 6.5" />,
  logout: <path d="M10 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H10M15 8l4 4-4 4M19 12H9" />,
  lock: <><rect x="5" y="10.5" width="14" height="9.5" rx="2.4" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></>,
  alert: <><path d="M12 4l9 16H3L12 4Z" /><path d="M12 10v4M12 17h.01" /></>,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8h.01" /></>,
  shield: <path d="M12 3l7 2.8v5.6c0 4.3-2.9 7.7-7 9.6-4.1-1.9-7-5.3-7-9.6V5.8L12 3Z" />,
  trash: <path d="M5 7h14M10 7V5h4v2M7 7l.8 12h8.4L17 7M10.5 11v5M13.5 11v5" />,
  chevron: <path d="M9.5 6l6 6-6 6" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  wifioff: <path d="M3 3l18 18M2 9a15 15 0 0 1 5-3M22 9a15 15 0 0 0-8-4M5.5 12.5a10 10 0 0 1 3-2M18.5 12.5a10 10 0 0 0-3-2M9 16a5 5 0 0 1 6 0M12 20h.01" />,
  refresh: <path d="M20 11a8 8 0 0 0-14.3-4.2L4 9M4 4v5h5M4 13a8 8 0 0 0 14.3 4.2L20 15M20 20v-5h-5" />,
  download: <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14" />,
  share: <path d="M12 15V4M8 8l4-4 4 4M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13" />,
  addsquare: <><rect x="4.5" y="4.5" width="15" height="15" rx="3" /><path d="M12 8.5v7M8.5 12h7" /></>,
  copy: <><rect x="8.5" y="8.5" width="11" height="11" rx="2.2" /><path d="M15.5 8.5V6A1.5 1.5 0 0 0 14 4.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" /></>,
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  chart: <path d="M5 20V10M12 20V4M19 20v-7" />,
  wallet: <><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10h18M16 14.5h2" /></>,
  retry: <path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5" />,
};

export type AcIconName = keyof typeof PATHS;

export default function AcIcon({ name, size = 20 }: { name: AcIconName; size?: number }) {
  return (
    <svg className="ac-ic" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}
