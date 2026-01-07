"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { OrderForm } from "@/components/OrderForm";
import { StatusCard, StatusState } from "@/components/StatusCard";
import { Timeline, TimelineEvent } from "@/components/Timeline";

type AgentEvent =
  | { type: "status"; state: "idle" | "running" | "completed" | "error"; message?: string; ts: number }
  | { type: "step"; id: string; title: string; state: "running" | "success" | "error"; ts: number; data?: unknown }
  | { type: "result"; ts: number; orderId: string; email?: string; emailSent?: boolean; message: string }
  | { type: "error"; ts: number; message: string; details?: unknown };

export default function Home() {
  const [status, setStatus] = useState<StatusState>("idle");
  const [orderId, setOrderId] = useState<string>("");
  const [customerEmail, setCustomerEmail] = useState<string>("");
  const [emailSent, setEmailSent] = useState<boolean | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);

  const handleProcessOrder = async (inputOrderId: string) => {
    setIsProcessing(true);
    setStatus("running");
    setOrderId(inputOrderId);
    setCustomerEmail("");
    setEmailSent(undefined);
    setErrorMessage("");
    setEvents([]);

    try {
      const response = await fetch("/api/process-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderId: inputOrderId }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data: AgentEvent = JSON.parse(line.slice(6));

              if (data.type === "status") {
                setStatus(data.state);
                if (data.state === "error" && data.message) {
                  setErrorMessage(data.message);
                }
              } else if (data.type === "step") {
                setEvents((prev) => {
                  const existingIndex = prev.findIndex((e) => e.id === data.id);
                  if (existingIndex >= 0) {
                    const updated = [...prev];
                    updated[existingIndex] = {
                      id: data.id,
                      timestamp: data.ts,
                      title: data.title,
                      state: data.state,
                      data: data.data,
                    };
                    return updated;
                  }
                  return [
                    ...prev,
                    {
                      id: data.id,
                      timestamp: data.ts,
                      title: data.title,
                      state: data.state,
                      data: data.data,
                    },
                  ];
                });
              } else if (data.type === "result") {
                setOrderId(data.orderId);
                if (data.email) setCustomerEmail(data.email);
                if (data.emailSent !== undefined) setEmailSent(data.emailSent);
              } else if (data.type === "error") {
                setErrorMessage(data.message);
                setStatus("error");
              }
            } catch (e) {
              console.error("Failed to parse SSE data:", e);
            }
          }
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      setErrorMessage(errorMsg);
      setStatus("error");
      setEvents((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          timestamp: Date.now(),
          title: "Connection Error",
          state: "error",
          data: { error: errorMsg },
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRunAgain = () => {
    if (orderId) {
      handleProcessOrder(orderId);
    }
  };

  const handleClearLog = () => {
    setEvents([]);
  };

  return (
    <AppShell>
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">
            Autonomous Ops Agent
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            MCP-powered order processing system
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2">
            <span className="badge badge-neutral">CRM:8001</span>
            <span className="badge badge-neutral">Email:8002</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Mobile environment badges */}
      <div className="flex sm:hidden items-center gap-2 mb-6">
        <span className="badge badge-neutral">CRM:8001</span>
        <span className="badge badge-neutral">Email:8002</span>
      </div>

      {/* Main content - two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-6">
          <div className="panel p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4">
              Process Order
            </h2>
            <OrderForm onSubmit={handleProcessOrder} isProcessing={isProcessing} />
          </div>

          <StatusCard
            state={status}
            orderId={orderId}
            customerEmail={customerEmail}
            emailSent={emailSent}
            errorMessage={errorMessage}
            onRunAgain={status === "completed" ? handleRunAgain : undefined}
          />
        </div>

        {/* Right column */}
        <div>
          <Timeline
            events={events}
            autoScroll={autoScroll}
            onClear={handleClearLog}
            onToggleAutoScroll={() => setAutoScroll(!autoScroll)}
          />
        </div>
      </div>
    </AppShell>
  );
}