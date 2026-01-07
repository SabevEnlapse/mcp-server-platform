"use client";

import { useState } from "react";

interface JsonDrawerProps {
  data: unknown;
  label?: string;
}

export function JsonDrawer({ data, label = "Details" }: JsonDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (data === null || data === undefined) return null;

  const jsonString = JSON.stringify(data, null, 2);

  return (
    <div className="mt-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-xs text-text-tertiary hover:text-text-secondary transition-colors"
      >
        <svg
          className={`h-4 w-4 transition-transform ${isOpen ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
        {label}
      </button>
      {isOpen && (
        <pre className="mt-2 p-3 bg-background-subtle rounded-lg overflow-x-auto text-xs font-mono text-text-secondary border border-border-subtle">
          {jsonString}
        </pre>
      )}
    </div>
  );
}