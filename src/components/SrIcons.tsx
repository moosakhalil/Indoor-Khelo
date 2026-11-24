// Small line icons for the Series screens. They are decoration: every one sits next to a word.
type P = { size?: number };
const base = (size: number) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, focusable: false });

export const IconTrophy = ({ size = 18 }: P) => <svg {...base(size)}><path d="M8 4h8v5a4 4 0 0 1-8 0V4z" /><path d="M8 6H5a2 2 0 0 0 2 4M16 6h3a2 2 0 0 1-2 4M12 13v4M8.5 20h7M10 17h4" /></svg>;
export const IconPlus = ({ size = 18 }: P) => <svg {...base(size)}><path d="M12 5v14M5 12h14" /></svg>;
export const IconSearch = ({ size = 18 }: P) => <svg {...base(size)}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>;
export const IconList = ({ size = 18 }: P) => <svg {...base(size)}><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" /></svg>;
export const IconLock = ({ size = 18 }: P) => <svg {...base(size)}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>;
export const IconPencil = ({ size = 18 }: P) => <svg {...base(size)}><path d="M4 20l4-1 11-11-3-3L5 16l-1 4z" /></svg>;
export const IconTrash = ({ size = 18 }: P) => <svg {...base(size)}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>;
export const IconInfo = ({ size = 18 }: P) => <svg {...base(size)}><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></svg>;
export const IconWarn = ({ size = 18 }: P) => <svg {...base(size)}><path d="M12 3l10 18H2L12 3z" /><path d="M12 10v5M12 18v.5" /></svg>;
export const IconCheck = ({ size = 16 }: P) => <svg {...base(size)}><path d="M5 13l4 4L19 7" /></svg>;
export const IconCross = ({ size = 16 }: P) => <svg {...base(size)}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const IconChevron = ({ size = 18 }: P) => <svg {...base(size)}><path d="M9 6l6 6-6 6" /></svg>;
export const IconBars = ({ size = 18 }: P) => <svg {...base(size)}><path d="M5 20V11M12 20V5M19 20v-7" /></svg>;
export const IconBall = ({ size = 28 }: P) => <svg {...base(size)}><circle cx="12" cy="12" r="9" /><path d="M5 7.5c3 1.5 5 1.5 8 0s5-1.5 6 0M5 16.5c3-1.5 5-1.5 8 0s5 1.5 6 0" /></svg>;
export const IconMinus = ({ size = 18 }: P) => <svg {...base(size)}><path d="M5 12h14" /></svg>;
export const IconFilter = ({ size = 18 }: P) => <svg {...base(size)}><path d="M4 6h16M7 12h10M10 18h4" /></svg>;
