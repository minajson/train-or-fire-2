import type { Metadata, Viewport } from "next";
import { Archivo, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

/*
 * One display family doing nearly all the work, at two very different weights.
 * Archivo holds its shape at 14rem on a projector and stays legible at 0.7rem
 * in a facilitator's sidebar, which is the whole range this app needs.
 */
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

/* Used in exactly one place: the four role quotes. */
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: ["400"],
  style: ["italic", "normal"],
  display: "swap",
});

/* Session codes and structural labels — a quiet technical register. */
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Train or Fire — The Warning Signs",
  description:
    "A live decision experience for HSE sessions. One failure. Four decisions. You decide.",
  applicationName: "Train or Fire",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#faf8f4",
  width: "device-width",
  initialScale: 1,
  // Participants tap large targets; pinch-zoom stays available regardless.
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${instrumentSerif.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-dvh bg-paper text-ink antialiased">{children}</body>
    </html>
  );
}
