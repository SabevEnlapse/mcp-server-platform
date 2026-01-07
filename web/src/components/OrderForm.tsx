"use client";

import { useState } from "react";

interface OrderFormProps {
  onSubmit: (orderId: string) => void;
  isProcessing: boolean;
}

const PRESET_ORDERS = ["XYZ-789", "ABC-123"];

export function OrderForm({ onSubmit, isProcessing }: OrderFormProps) {
  const [orderId, setOrderId] = useState("XYZ-789");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (orderId.trim()) {
      onSubmit(orderId.trim());
    }
  };

  const handleChipClick = (preset: string) => {
    if (!isProcessing) {
      setOrderId(preset);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="orderId" className="block text-sm font-medium text-text-secondary mb-2">
          Order ID
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            id="orderId"
            type="text"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="e.g., XYZ-789"
            className="input flex-1"
            disabled={isProcessing}
          />
          <button
            type="submit"
            disabled={isProcessing || !orderId.trim()}
            className="btn btn-primary min-w-[140px]"
          >
            {isProcessing ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
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
                Processing...
              </>
            ) : (
              "Process Order"
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-text-tertiary">Quick select:</span>
        {PRESET_ORDERS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => handleChipClick(preset)}
            disabled={isProcessing}
            className={`chip ${orderId === preset ? "active" : ""}`}
          >
            {preset}
          </button>
        ))}
      </div>
    </form>
  );
}