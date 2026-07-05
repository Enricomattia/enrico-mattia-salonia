"use client";

import type React from "react";
import { clarityEvent, setClarityTag } from "@/lib/clarity";

interface TrackedLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  eventName: string;
  tags?: Record<string, string>;
}

export default function TrackedLink({ eventName, tags, onClick, children, ...props }: TrackedLinkProps) {
  return (
    <a
      {...props}
      onClick={(event) => {
        Object.entries(tags || {}).forEach(([key, value]) => setClarityTag(key, value));
        clarityEvent(eventName);
        onClick?.(event);
      }}
    >
      {children}
    </a>
  );
}
