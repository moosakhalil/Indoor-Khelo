// Phase F4 (UI redesign, payments): the icons the booking screens use. Decorative: the words next to them carry the meaning.
type Name =
  | "alert" | "info" | "check" | "clock" | "plus" | "bell" | "undo" | "lock" | "edit" | "trash" | "search" | "users" | "user"
  | "link" | "x" | "half" | "flag" | "chevron" | "wallet" | "refund" | "calendar" | "phone" | "ban";

const PATHS: Record<Name, React.ReactNode> = {
  alert: <><path d="M12 3.5 2.8 19.5h18.4L12 3.5Z" /><path d="M12 10v4.5M12 17.4v.1" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8v.1" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  bell: <><path d="M6 16V11a6 6 0 0 1 12 0v5l1.6 2H4.4L6 16Z" /><path d="M10 20.5a2.2 2.2 0 0 0 4 0" /></>,
  undo: <><path d="M9 7 4.5 11.5 9 16" /><path d="M5 11.5h9a5 5 0 0 1 0 10h-2" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="9.5" rx="2" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></>,
  edit: <><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" /><path d="m13.5 7.5 3 3" /></>,
  trash: <><path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13" /><path d="M10.5 11v6M13.5 11v6" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>,
  users: <><circle cx="9" cy="9" r="3.2" /><path d="M3 19.5c.6-3.2 2.8-4.8 6-4.8s5.4 1.6 6 4.8" /><path d="M16 6.2a3.1 3.1 0 0 1 0 5.8M18.5 15c1.4.8 2.2 2.2 2.5 4" /></>,
  user: <><circle cx="12" cy="8.5" r="3.6" /><path d="M5 20c.7-3.6 3.4-5.4 7-5.4s6.3 1.8 7 5.4" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  x: <path d="m6 6 12 12M18 6 6 18" />,
  half: <><circle cx="12" cy="12" r="9" /><path d="M12 3v18a9 9 0 0 1 0-18Z" fill="currentColor" /></>,
  flag: <><path d="M6 21V4" /><path d="M6 5h11l-2 4 2 4H6" /></>,
  chevron: <path d="m9 5 7 7-7 7" />,
  wallet: <><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M3 10h18M16.5 14.5h.1" /></>,
  refund: <><path d="M9 7 4.5 11.5 9 16" /><path d="M5 11.5h9.5a4.5 4.5 0 0 1 0 9H12" /></>,
  calendar: <><rect x="4" y="5.5" width="16" height="14.5" rx="2.5" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></>,
  phone: <><rect x="7" y="3" width="10" height="18" rx="2.5" /><path d="M11 17.5h2" /></>,
  ban: <><circle cx="12" cy="12" r="9" /><path d="m6 18 12-12" /></>,
};

export type PbIconName = Name;

export default function PbIcon({ name, size = 18 }: { name: Name; size?: number }) {
  return (
    <svg className="pb-ic" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}
