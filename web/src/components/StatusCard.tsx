"use client";

import { useState } from "react";

export type StatusState = "idle" | "running" | "completed" | "error";

interface StatusCardProps {
  state: StatusState;
  orderId?: string;
  customerEmail?: string;
  emailSent?: boolean;
  errorMessage?: string;
  onRunAgain?: () => void;
}

export function StatusCard({
  state,
  orderId,
  customerEmail,
  emailSent,
  errorMessage,
  onRunAgain,
}: StatusCardProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const getStatusBadge = () => {
    switch (state) {
      case "idle":
        return <span className="badge badge-neutral">Idle</span>;
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
      case "completed":
        return <span className="badge badge-success">Completed</span>;
      case "error":
        return <span className="badge badge-error">Error</span>;
    }
  };

  return (
    <div className="panel p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-text-primary">Status</h3>
        {getStatusBadge()}
      </div>

      {state === "idle" && (
        <p className="text-text-secondary text-sm">
          Ready to process orders. Enter an order ID above to begin.
        </p>
      )}

      {(state === "completed" || state === "error") && (
        <div className="space-y-3">
          {orderId && (
            <div className="flex items-center justify-between py-2 border-b border-border-subtle">
              <span className="text-sm text-text-secondary">Order ID</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-text-primary">{orderId}</span>
                <button
                  onClick={() => copyToClipboard(orderId, "orderId")}
                  className="btn-ghost p-1 rounded"
                  title="Copy to clipboard"
                >
                  {copied === "orderId" ? (
                    <svg className="h-4 w-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          )}

          {customerEmail && (
            <div className="flex items-center justify-between py-2 border-b border-border-subtle">
              <span className="text-sm text-text-secondary">Customer Email</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-text-primary">{customerEmail}</span>
                <button
                  onClick={() => copyToClipboard(customerEmail, "email")}
                  className="btn-ghost p-1 rounded"
                  title="Copy to clipboard"
                >
                  {copied === "email" ? (
                    <svg className="h-4 w-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          )}

          {emailSent !== undefined && (
            <div className="flex items-center justify-between py-2 border-b border-border-subtle">
              <span className="text-sm text-text-secondary">Email Sent</span>
              <span className={`text-sm font-medium ${emailSent ? "text-success" : "text-error"}`}>
                {emailSent ? "Yes" : "No"}
              </span>
            </div>
          )}

          {errorMessage && (
            <div className="py-2">
              <span className="text-sm text-text-secondary block mb-1">Error</span>
              <p className="text-sm text-error">{errorMessage}</p>
            </div>
          )}

          {state === "completed" && onRunAgain && (
            <button
              onClick={onRunAgain}
              className="btn btn-secondary w-full mt-4"
            >
              Run Again
            </button>
          )}
        </div>
      )}
    </div>
  );
}