// Small line icons for the Payments screens (Phase F3). Always decorative: a word sits next to each one.
// Also available elsewhere: IconPlus, IconSearch, IconCheck, IconCross, IconPencil, IconTrash, IconWarn, IconLock, IconInfo, IconUser (B4Icons), IconPin, IconClock (CrIcons).
type P = { size?: number };
const base = (size: number) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, focusable: false });

export const IconWallet = ({ size = 22 }: P) => <svg {...base(size)}><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M3 10h18M16 14.5h2" /></svg>;
export const IconFlag = ({ size = 16 }: P) => <svg {...base(size)}><path d="M6 21V4M6 5h11l-2 4 2 4H6" /></svg>;
export const IconBack = ({ size = 18 }: P) => <svg {...base(size)}><path d="M15 6l-6 6 6 6" /></svg>;
export const IconArrow = ({ size = 18 }: P) => <svg {...base(size)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
