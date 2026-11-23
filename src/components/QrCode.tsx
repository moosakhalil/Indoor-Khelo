import QRCode from "qrcode";

/** A scannable QR code for the invite link. Drawn on white so phone cameras read it. */
export default async function QrCode({ value, label }: { value: string; label: string }) {
  const svg = await QRCode.toString(value, { type: "svg", margin: 2, errorCorrectionLevel: "M", color: { dark: "#0B1020", light: "#FFFFFF" } });
  return (
    <div
      role="img"
      aria-label={label}
      style={{ width: 200, maxWidth: "100%", margin: "0 auto", background: "#fff", borderRadius: 14, padding: 6, lineHeight: 0 }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
