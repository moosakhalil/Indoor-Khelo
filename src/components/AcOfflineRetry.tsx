"use client";

// Phase G3: the retry part of the offline page. The button is a real link to "/" first (so it still works if the scripts are not
// available), and with scripts it tries the page the person was on. It also tries by itself when the phone says the signal is back.
// Nothing here is fetched: it only reloads the page.
import { useEffect, useState } from "react";
import AcIcon from "@/components/AcIcons";

function tryAgain() {
  // The service worker answers with this page at the address that failed, so a reload retries that address.
  if (window.location.pathname === "/offline") window.location.href = "/";
  else window.location.reload();
}

export default function AcOfflineRetry() {
  const [still, setStill] = useState(false);
  useEffect(() => {
    const on = () => tryAgain();
    window.addEventListener("online", on);
    return () => window.removeEventListener("online", on);
  }, []);
  return (
    <div className="ac-off-retry">
      <p className="ac-off-auto"><AcIcon name="retry" size={16} /> Indoor Khelo reconnects by itself when the signal is back.</p>
      <a
        className="btn gold"
        href="/"
        onClick={(e) => {
          if (typeof navigator !== "undefined" && navigator.onLine === false) { e.preventDefault(); setStill(true); return; }
          e.preventDefault();
          tryAgain();
        }}
      >
        Try again
      </a>
      <p className="ac-off-still" role="status">{still ? "Still no signal. We will try again when it is back." : ""}</p>
    </div>
  );
}
