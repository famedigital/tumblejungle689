import QRCode from "qrcode";

export async function qrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    margin: 1,
    width: 360,
    errorCorrectionLevel: "M",
    color: { dark: "#1f4d3a", light: "#ffffff" },
  });
}
