"use client";

import { JsonDrawer } from "./JsonDrawer";
import type { TimelineEventState } from "./timeline.types";

interface TimelineItemProps {
  timestamp: string;
  title: string;
  state: TimelineEventState;
  data?: unknown;
}

export function TimelineItem({ timestamp, title, state, data }: TimelineItemProps) {
  const getStateBadge = () => {
    switch (state) {
      case "running":
        return (
          <span className="badge badge-info">
            <svg
              className="animate-spin h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Running
          </span>
        );
      case "success":
        return <span className="badge badge-success">Success</span>;
      case "error":
        return <span className="badge badge-error">Error</span>;
    }
  };

  const getStateIcon = () => {
    switch (state) {
      case "running":
        return (
          <div className="h-2 w-2 rounded-full bg-info animate-pulse" />
        );
      case "success":
        return (
          <div className="h-2 w-2 rounded-full bg-success" />
        );
      case "error":
        return (
          <div className="h-2 w-2 rounded-full bg-error" />
        );
    }
  };

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="mt-1.5">{getStateIcon()}</div>
        <div className="flex-1 w-px bg-border-subtle mt-2" />
      </div>
      <div className="flex-1 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-text-primary">{title}</p>
            <p className="text-xs text-text-tertiary mt-0.5">{timestamp}</p>
          </div>
          {getStateBadge()}
        </div>
        {data ? <JsonDrawer data={data} /> : null}
      </div>
    </div>
  );
}