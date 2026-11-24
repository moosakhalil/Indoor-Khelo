// Builder 3: the few line icons the Members, Manage member, Join requests and Settings screens use.
// Always decorative: every button that carries one also has words.
const paths = {
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></>,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  chevron: <path d="M9 5l7 7-7 7" />,
  warn: <><path d="M12 3.5l9.5 16.5h-19z" /><path d="M12 10v4.5M12 17.4v.1" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8v.1" /></>,
  shield: <path d="M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6z" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4.5 20c1-4 4-6 7.5-6s6.5 2 7.5 6" /></>,
  grid: <><rect x="4" y="4" width="6.5" height="6.5" rx="1.2" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2" /></>,
  trash: <><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6" /></>,
  exit: <><path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9" /></>,
  pin: <><path d="M12 21s6.5-6 6.5-11a6.5 6.5 0 10-13 0C5.5 15 12 21 12 21z" /><circle cx="12" cy="10" r="2.3" /></>,
  share: <><path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  userPlus: <><circle cx="10" cy="8" r="4" /><path d="M3 20c1-4 3.5-6 7-6M18 8v6M15 11h6" /></>,
};

export type B3IconName = keyof typeof paths;

export default function Ic({ name }: { name: B3IconName }) {
  return (
    <svg className="b3-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  );
}
