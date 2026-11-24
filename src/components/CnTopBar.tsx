import Link from "next/link";
import "./cn.css";

/**
 * The top bar for the entry pages that come before any community shell (Waiting, Pick your number):
 * optional back arrow, the app logo and name. Plain markup, no network except the logo file.
 */
export default function CnTopBar({ back }: { back?: string }) {
  return (
    <header className="topbar cn-top">
      {back && <Link href={back} className="back" aria-label="Back">‹</Link>}
      <span className="cn-brand">
        <img src="/icons/icon-192.png" alt="" width={28} height={28} />
        <b>Indoor <span>Khelo</span></b>
      </span>
    </header>
  );
}
