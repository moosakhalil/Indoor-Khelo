// Small line icons for the matches and teams screens. Always decorative: the words next to them carry the meaning.
type P = { size?: number };
const base = (size: number) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, focusable: false });

export const IconPlus = ({ size = 18 }: P) => <svg {...base(size)}><path d="M12 5v14M5 12h14" /></svg>;
export const IconCalendar = ({ size = 18 }: P) => <svg {...base(size)}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>;
export const IconSignalOff = ({ size = 18 }: P) => <svg {...base(size)}><path d="M3 3l18 18M8.5 8.5a5 5 0 0 0-1.5 3.5M5 5a9 9 0 0 0-2 7M15.5 8.5a5 5 0 0 1 1.5 3.5M19 5a9 9 0 0 1 2 7" /><circle cx="12" cy="12" r="1.5" /></svg>;
export const IconSearch = ({ size = 18 }: P) => <svg {...base(size)}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>;
export const IconCheck = ({ size = 16 }: P) => <svg {...base(size)}><path d="M5 13l4 4L19 7" /></svg>;
export const IconCross = ({ size = 16 }: P) => <svg {...base(size)}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const IconBall = ({ size = 28 }: P) => <svg {...base(size)}><circle cx="12" cy="12" r="9" /><path d="M5 7.5c3 1.5 5 1.5 8 0s5-1.5 6 0M5 16.5c3-1.5 5-1.5 8 0s5 1.5 6 0" /></svg>;
export const IconUsers = ({ size = 28 }: P) => <svg {...base(size)}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.5 2.9-6 6.5-6s6.5 2.5 6.5 6" /><circle cx="17" cy="9" r="2.5" /><path d="M17 14c2.7 0 4.5 1.9 4.5 4.5" /></svg>;
export const IconPencil = ({ size = 18 }: P) => <svg {...base(size)}><path d="M4 20l4-1 11-11-3-3L5 16l-1 4z" /></svg>;
export const IconTrash = ({ size = 18 }: P) => <svg {...base(size)}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>;
export const IconWarn = ({ size = 18 }: P) => <svg {...base(size)}><path d="M12 3l10 18H2L12 3z" /><path d="M12 10v5M12 18v.5" /></svg>;
export const IconLock = ({ size = 18 }: P) => <svg {...base(size)}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>;
export const IconInfo = ({ size = 18 }: P) => <svg {...base(size)}><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></svg>;
export const IconChevron = ({ size = 18 }: P) => <svg {...base(size)}><path d="M9 6l6 6-6 6" /></svg>;
export const IconUser = ({ size = 18 }: P) => <svg {...base(size)}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" /></svg>;
