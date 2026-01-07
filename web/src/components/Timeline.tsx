"use client";

import { useEffect, useRef } from "react";
import { TimelineItem } from "./TimelineItem";
import type { TimelineEventState, TimelineEvent } from "./timeline.types";

export type { TimelineEventState, TimelineEvent };

interface TimelineProps {
  events: TimelineEvent[];
  autoScroll?: boolean;
  onClear?: () => void;
  onToggleAutoScroll?: () => void;
}

export function Timeline({
  events,
  autoScroll = true,
  onClear,
  onToggleAutoScroll,
}: TimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events, autoScroll]);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div className="panel p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-text-primary">Activity Timeline</h3>
        <div className="flex items-center gap-2">
          {onToggleAutoScroll && (
            <button
              onClick={onToggleAutoScroll}
              className={`btn-ghost px-3 py-1.5 text-xs rounded-md ${
                autoScroll ? "text-accent" : "text-text-tertiary"
              }`}
            >
              Auto-scroll
            </button>
          )}
          {onClear && events.length > 0 && (
            <button
              onClick={onClear}
              className="btn-ghost px-3 py-1.5 text-xs text-text-tertiary hover:text-error rounded-md"
            >
              Clear log
            </button>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="space-y-3 max-h-[400px] overflow-y-auto pr-2"
      >
        {events.length === 0 ? (
          <p className="text-sm text-text-tertiary text-center py-8">
            No activity yet. Process an order to see events here.
          </p>
        ) : (
          events.map((event) => (
            <TimelineItem
              key={event.id}
              timestamp={formatTime(event.timestamp)}
              title={event.title}
              state={event.state}
              data={event.data}
            />
          ))
        )}
      </div>
    </div>
  );
}