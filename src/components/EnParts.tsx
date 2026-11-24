import Link from "next/link";
import EnAccountMenu from "@/components/EnAccountMenu";
import EnIcon from "@/components/EnIcons";
import "./en.css";

/** The small logo and the wordmark. The picture is the app icon that is already kept on the phone (precached by the service worker). */
export function EnBrand({ href }: { href?: string }) {
  const inner = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="" width={28} height={28} className="en-brand-img" />
      <span className="en-wordmark">Indoor <b>Khelo</b></span>
    </>
  );
  return href ? <Link href={href} className="en-brand" aria-label="Indoor Khelo, start page">{inner}</Link> : <span className="en-brand">{inner}</span>;
}

/** The top bar of the pages that come before a community exists: optional back button, the brand, optional account menu. */
export function EnTopBar({ back, user, showAccount = true }: { back?: string; user?: { name: string }; showAccount?: boolean }) {
  return (
    <header className="topbar en-top">
      {back && <Link href={back} className="en-back" aria-label="Back"><EnIcon name="back" size={22} /></Link>}
      <EnBrand />
      <span className="grow" />
      {user && <EnAccountMenu name={user.name} showAccount={showAccount} />}
    </header>
  );
}

/** A heading block: optional small label above, a big title and one quiet line. */
export function EnHead({ eyebrow, title, lead }: { eyebrow?: string; title: React.ReactNode; lead?: React.ReactNode }) {
  return (
    <div className="en-head">
      {eyebrow && <p className="en-eyebrow">{eyebrow}</p>}
      <h1 className="en-h1">{title}</h1>
      {lead && <p className="en-lead">{lead}</p>}
    </div>
  );
}

/** A message with an icon and a bold title, so it is understood without colour. Used for errors on these pages. */
export function EnAlert({ title, children, icon = "warn", id }: { title?: string; children?: React.ReactNode; icon?: "warn" | "wifioff"; id?: string }) {
  return (
    <div className="en-alert" role="alert" id={id}>
      <EnIcon name={icon} size={20} />
      <div>
        {title && <b className="en-alert-t">{title}</b>}
        {children && <span className="en-alert-b">{children}</span>}
      </div>
    </div>
  );
}

/** A small inline error that sits under the field it belongs to. */
export function EnFieldError({ id, text }: { id: string; text?: string }) {
  if (!text) return null;
  return <p className="en-ferr" id={id} role="alert"><EnIcon name="warn" size={16} />{text}</p>;
}

/** The loading screen shown while a redirect resolves (/home, /profile) and after tapping Open on /switch.
 *  The logo, a line saying what is happening and a moving bar, instead of a blank dark page. */
export function EnSplash({ title = "Opening Indoor Khelo", sub = "Checking your communities…", overlay }: { title?: string; sub?: string; overlay?: boolean }) {
  return (
    <div className={`en-splash${overlay ? " en-splash-overlay" : ""}`} role="status" aria-live="polite">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="Indoor Khelo logo" width={88} height={88} className="en-splash-img" />
      <p className="en-splash-t">{title}</p>
      <p className="en-splash-s">{sub}</p>
      <span className="en-bar" aria-hidden="true"><i /></span>
    </div>
  );
}
