"use client";

import { useOrigin } from "./browser-state";

/**
 * Where the QR points.
 *
 * The join code is projected onto a wall and scanned by phones that are not on
 * the developer's machine and often not on the office wifi either. So the one
 * thing this module exists to prevent is a projector confidently displaying a
 * QR for `http://localhost:3000` — which scans perfectly, opens nothing, and is
 * discovered thirty seconds into a live session.
 *
 * Resolution order:
 *
 *   1. NEXT_PUBLIC_APP_URL, when it is set and parses as an http(s) origin.
 *      Set this on the production environment only, so preview deployments
 *      keep pointing at themselves and local development keeps working with no
 *      configuration at all.
 *   2. The origin the page was actually loaded from.
 *
 * Nothing secret goes near this. The QR encodes `<origin>/j/<code>` and only
 * that — no facilitator token, no participant secret, no query string.
 */

function normalize(raw: string | undefined): string {
  const value = raw?.trim();
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    return url.origin;
  } catch {
    return "";
  }
}

/**
 * Inlined at build time by Next, so this is a constant in the client bundle
 * rather than a runtime lookup. It is a public URL by definition — it is
 * printed on the projector in plain text next to the code.
 */
export const CANONICAL_APP_URL = normalize(process.env.NEXT_PUBLIC_APP_URL);

const PRIVATE_HOST =
  /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[?::1\]?|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|.*\.local)$/i;

/**
 * True when a phone somewhere else could actually open this origin.
 *
 * Used to warn the facilitator rather than to block anything: a LAN address is
 * exactly right for a room on one wifi, and wrong for anyone dialling in, and
 * only the person running the session knows which of those they are doing.
 */
export function isPubliclyReachable(origin: string): boolean {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    if (PRIVATE_HOST.test(url.hostname)) return false;
    // Tunnels and IDE port-forward hosts resolve for the developer and nobody
    // else in the room.
    if (/\.(githubpreview|gitpod|app\.github)\.dev$/i.test(url.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

/** The origin every join link and QR is built from. */
export function useJoinOrigin(): string {
  const pageOrigin = useOrigin();
  return CANONICAL_APP_URL || pageOrigin;
}

/** The only URL this app ever puts in a QR code. */
export function joinUrl(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, "")}/j/${encodeURIComponent(code)}`;
}
