"use client";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/** Send anonymous interaction events to the GA4 tag loaded by the site layout. */
export function trackAnalyticsEvent(
  name: string,
  params?: Record<string, string | number | boolean>
) {
  if (typeof window === "undefined") return;
  window.gtag?.("event", name, params ?? {});
}
