"use client";

/**
 * AttributionCapture — BOOKING-ATTRIBUTION-01
 *
 * Mounted once in the root layout. On the first render of a full page load it
 * records the visit's UTM tags / external referrer as the first touch (see
 * src/lib/attribution.ts). Client-side navigations keep the same document.referrer
 * and carry no new tags, so running once per load is enough. Renders nothing.
 */

import { useEffect } from "react";
import { captureFirstTouch } from "@/lib/attribution";

export function AttributionCapture() {
  useEffect(() => {
    captureFirstTouch(window.location.href, document.referrer);
  }, []);
  return null;
}
