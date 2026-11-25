import type { Metadata } from "next";
import InstallGuide from "@/components/InstallGuide";
import "@/components/install.css";

export const metadata: Metadata = {
  title: "Install the app",
  description: "Add Indoor Khelo to your phone's home screen. Step by step for iPhone and Android.",
  openGraph: {
    title: "Install Indoor Khelo",
    description: "Add it to your home screen in a few taps. Works on iPhone and Android.",
    images: [{ url: "/icons/icon-512.png", width: 512, height: 512 }],
  },
};

// A public page you can send to anyone (WhatsApp, a poster, a QR code). No sign-in needed:
// it only teaches how to put the app on the home screen. The guide itself picks iPhone or Android steps.
export default function InstallPage() {
  return (
    <main className="app ins-app">
      <InstallGuide />
    </main>
  );
}
