"use client";

import type React from "react";
import { clarityEvent, setClarityTag } from "@/lib/clarity";
import { trackAnalyticsEvent } from "@/lib/analytics";

interface TrackedLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  eventName: string;
  gaEventName?: string;
  tags?: Record<string, string>;
}

export default function TrackedLink({ eventName, gaEventName, tags, onClick, children, ...props }: TrackedLinkProps) {
  return (
    <a
      {...props}
      onClick={(event) => {
        Object.entries(tags || {}).forEach(([key, value]) => setClarityTag(key, value));
        clarityEvent(eventName);
        if (gaEventName) trackAnalyticsEvent(gaEventName, tags);
        onClick?.(event);
      }}
    >
      {children}
    </a>
  );
}
