"use client";

declare global {
  interface Window {
    clarity?: (...args: unknown[]) => void;
  }
}

export function clarityEvent(name: string) {
  if (typeof window === "undefined") return;
  window.clarity?.("event", name);
}

export function setClarityTag(key: string, value: string | string[]) {
  if (typeof window === "undefined") return;
  window.clarity?.("set", key, value);
}
