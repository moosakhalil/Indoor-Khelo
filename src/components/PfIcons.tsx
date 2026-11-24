// Small line icons for My profile, Edit my profile and the Player page (Phase F5). Always decoration: a word sits next to every one.
const PATHS: Record<string, React.ReactNode> = {
  pencil: <path d="M4 20l1-4L16.5 4.5a2 2 0 0 1 2.8 0l.2.2a2 2 0 0 1 0 2.8L8 19l-4 1Z" />,
  chart: <path d="M5 20V10M12 20V4M19 20v-7" />,
  wallet: <><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10h18M16 14.5h2" /></>,
  swap: <path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  chevron: <path d="M9.5 6l6 6-6 6" />,
  chevdown: <path d="M6 9.5l6 6 6-6" />,
  logout: <path d="M10 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H10M15 8l4 4-4 4M19 12H9" />,
  users: <><circle cx="9" cy="8.5" r="3.3" /><path d="M2.8 19.5c0-3.2 2.7-5.5 6.2-5.5s6.2 2.3 6.2 5.5M16 5.5a3.3 3.3 0 0 1 0 6.2M18 14.3c2.2.6 3.4 2.4 3.4 5.2" /></>,
  cog: <><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" /></>,
  shield: <path d="M12 3l7 2.8v5.6c0 4.3-2.9 7.7-7 9.6-4.1-1.9-7-5.3-7-9.6V5.8L12 3Z" />,
  share: <path d="M12 15V4M8 8l4-4 4 4M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13" />,
  copy: <><rect x="8.5" y="8.5" width="11" height="11" rx="2.2" /><path d="M15.5 8.5V6A1.5 1.5 0 0 0 14 4.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" /></>,
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  alert: <><path d="M12 4l9 16H3L12 4Z" /><path d="M12 10v4M12 17h.01" /></>,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8h.01" /></>,
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  star: <path d="M12 3.5l2.5 5.3 5.8.7-4.3 4 1.1 5.7L12 16.3 6.9 19.2 8 13.5l-4.3-4 5.8-.7L12 3.5Z" />,
  user: <><circle cx="12" cy="8" r="3.8" /><path d="M4.5 20c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6" /></>,
};

export type PfIconName = keyof typeof PATHS;

export default function PfIcon({ name, size = 20 }: { name: PfIconName; size?: number }) {
  return (
    <svg className="pf-ic" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}
