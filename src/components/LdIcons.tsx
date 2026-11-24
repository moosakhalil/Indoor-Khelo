// Small line icons for the leaderboard, compare, insights and player analytics screens.
// Always decorative: the words next to them carry the meaning.
type P = { size?: number };
const base = (size: number) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, focusable: false });

export const IconFilter = ({ size = 18 }: P) => <svg {...base(size)}><path d="M4 6h16M7 12h10M10 18h4" /></svg>;
export const IconSwap = ({ size = 18 }: P) => <svg {...base(size)}><path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" /></svg>;
export const IconClose = ({ size = 16 }: P) => <svg {...base(size)}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const IconInfo = ({ size = 18 }: P) => <svg {...base(size)}><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></svg>;
export const IconWarn = ({ size = 18 }: P) => <svg {...base(size)}><path d="M12 3l10 18H2L12 3z" /><path d="M12 10v5M12 18v.5" /></svg>;
export const IconChart = ({ size = 28 }: P) => <svg {...base(size)}><path d="M4 20V10M10 20V4M16 20v-8M22 20H2" /></svg>;
export const IconTrophy = ({ size = 28 }: P) => <svg {...base(size)}><path d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H4v2a3 3 0 0 0 4 2.8M16 6h4v2a3 3 0 0 1-4 2.8M12 13v4M8 21h8M10 17h4" /></svg>;
export const IconPair = ({ size = 28 }: P) => <svg {...base(size)}><circle cx="9" cy="8" r="3.5" /><circle cx="16" cy="9" r="3" /><path d="M2.5 20c0-3.5 2.9-6 6.5-6s6.5 2.5 6.5 6M16 14c2.8 0 4.5 1.9 4.5 4.5" /></svg>;
export const IconBall = ({ size = 28 }: P) => <svg {...base(size)}><circle cx="12" cy="12" r="9" /><path d="M5 7.5c3 1.5 5 1.5 8 0s5-1.5 6 0M5 16.5c3-1.5 5-1.5 8 0s5 1.5 6 0" /></svg>;
export const IconHelp = ({ size = 28 }: P) => <svg {...base(size)}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17v.5" /></svg>;
export const IconStats = ({ size = 18 }: P) => <svg {...base(size)}><path d="M5 20V12M12 20V5M19 20v-9" /></svg>;
export const IconChevronDown = ({ size = 16 }: P) => <svg {...base(size)}><path d="M6 9l6 6 6-6" /></svg>;
export const IconSearch = ({ size = 18 }: P) => <svg {...base(size)}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>;
export const IconCheck = ({ size = 16 }: P) => <svg {...base(size)}><path d="M5 13l4 4L19 7" /></svg>;
export const IconUp = ({ size = 14 }: P) => <svg {...base(size)}><path d="M5 15l7-7 7 7" /></svg>;
export const IconDown = ({ size = 14 }: P) => <svg {...base(size)}><path d="M5 9l7 7 7-7" /></svg>;
export const IconMinus = ({ size = 14 }: P) => <svg {...base(size)}><path d="M5 12h14" /></svg>;
export const IconMatch = ({ size = 16 }: P) => <svg {...base(size)}><circle cx="12" cy="12" r="9" /><path d="M9 8l7 4-7 4z" /></svg>;
