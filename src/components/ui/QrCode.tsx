"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Rendered as a PNG data URL rather than inline SVG markup — nothing in this
 * app injects HTML it did not build itself, and a 1024px raster stays sharp on
 * a 4K projector while remaining a single element to animate.
 */
export function QrCode({
  value,
  size = 1024,
  className,
  dark = "#12100e",
  light = "#ffffff",
  /**
   * Quiet-zone width in modules. The QR standard asks for 4, and a code that
   * is going to be photographed off a projected surface — with keystone, glare
   * and a phone held at an angle — is exactly the case the margin exists for.
   * Callers that sit the code on their own white card can pass less.
   */
  margin = 4,
}: {
  value: string;
  size?: number;
  className?: string;
  dark?: string;
  light?: string;
  margin?: number;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, {
      width: size,
      margin,
      errorCorrectionLevel: "M",
      color: { dark, light },
    })
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [value, size, dark, light, margin]);

  return (
    <div
      className={cn("relative aspect-square overflow-hidden", className)}
      style={{ background: light }}
    >
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`QR code to join at ${value}`}
          className="h-full w-full object-contain"
          draggable={false}
        />
      )}
    </div>
  );
}
