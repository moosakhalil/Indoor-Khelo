import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Indoor Khelo",
    short_name: "Indoor Khelo",
    description: "Play. Score. Split. The indoor cricket community app.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0B1020",
    theme_color: "#0B1020",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Start scoring", short_name: "Score", url: "/home?shortcut=scoring", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Book a slot", short_name: "Book", url: "/home?shortcut=booking", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
