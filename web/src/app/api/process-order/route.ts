import { NextRequest } from "next/server";
import { MCPClient } from "@/lib/mcp-client";

export const runtime = "nodejs";

type AgentEvent =
  | { type: "status"; state: "idle" | "running" | "completed" | "error"; message?: string; ts: number }
  | { type: "step"; id: string; title: string; state: "running" | "success" | "error"; ts: number; data?: unknown }
  | { type: "result"; ts: number; orderId: string; email?: string; emailSent?: boolean; message: string }
  | { type: "error"; ts: number; message: string; details?: unknown };

function sendSSEEvent(
  encoder: TextEncoder,
  controller: ReadableStreamDefaultController,
  event: AgentEvent
) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  controller.enqueue(encoder.encode(data));
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { orderId } = body;

  if (!orderId || typeof orderId !== "string") {
    return new Response(JSON.stringify({ error: "Invalid order ID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const crmUrl = process.env.CRM_MCP_URL || "http://127.0.0.1:8001";
      const emailUrl = process.env.EMAIL_MCP_URL || "http://127.0.0.1:8002";

      const crmClient = new MCPClient(crmUrl);
      const emailClient = new MCPClient(emailUrl);

      const stepId = (name: string) => `${name}-${Date.now()}`;

      try {
        // Initial status
        sendSSEEvent(encoder, controller, {
          type: "status",
          state: "running",
          ts: Date.now(),
        });

        // Step 1: Connect to CRM
        const connectCrmId = stepId("connect-crm");
        sendSSEEvent(encoder, controller, {
          type: "step",
          id: connectCrmId,
          title: "Connecting to CRM server...",
          state: "running",
          ts: Date.now(),
        });

        await crmClient.connect();

        sendSSEEvent(encoder, controller, {
          type: "step",
          id: connectCrmId,
          title: "Connected to CRM server",
          state: "success",
          ts: Date.now(),
        });

        // Step 2: Fetch customer email
        const fetchEmailId = stepId("fetch-email");
        sendSSEEvent(encoder, controller, {
          type: "step",
          id: fetchEmailId,
          title: `Fetching customer email for order #${orderId}...`,
          state: "running",
          ts: Date.now(),
        });

        const crmResult = await crmClient.callTool("getCustomerEmail", {
          order_id: orderId,
        });

        const emailData = JSON.parse(crmResult.content[0].text);
        const customerEmail = emailData.email;

        if (!customerEmail) {
          throw new Error("Customer not found for this order ID");
        }

        sendSSEEvent(encoder, controller, {
          type: "step",
          id: fetchEmailId,
          title: `Found customer email: ${customerEmail}`,
          state: "success",
          ts: Date.now(),
          data: { email: customerEmail },
        });

        // Send intermediate result
        sendSSEEvent(encoder, controller, {
          type: "result",
          ts: Date.now(),
          orderId,
          email: customerEmail,
          emailSent: false,
          message: "Customer email retrieved",
        });

        // Step 3: Connect to Email server
        const connectEmailId = stepId("connect-email");
        sendSSEEvent(encoder, controller, {
          type: "step",
          id: connectEmailId,
          title: "Connecting to Email server...",
          state: "running",
          ts: Date.now(),
        });

        await emailClient.connect();

        sendSSEEvent(encoder, controller, {
          type: "step",
          id: connectEmailId,
          title: "Connected to Email server",
          state: "success",
          ts: Date.now(),
        });

        // Step 4: Send shipping confirmation
        const sendEmailId = stepId("send-email");
        sendSSEEvent(encoder, controller, {
          type: "step",
          id: sendEmailId,
          title: "Sending shipping confirmation email...",
          state: "running",
          ts: Date.now(),
        });

        const emailResult = await emailClient.callTool(
          "sendShippingConfirmation",
          {
            email: customerEmail,
            order_details: { order_id: orderId },
          }
        );

        const emailResponse = JSON.parse(emailResult.content[0].text);

        if (emailResponse.ok) {
          sendSSEEvent(encoder, controller, {
            type: "step",
            id: sendEmailId,
            title: `Shipping confirmation sent: ${emailResponse.message}`,
            state: "success",
            ts: Date.now(),
            data: { message: emailResponse.message },
          });

          // Final result
          sendSSEEvent(encoder, controller, {
            type: "result",
            ts: Date.now(),
            orderId,
            email: customerEmail,
            emailSent: true,
            message: "Order processing completed successfully",
          });

          // Final status
          sendSSEEvent(encoder, controller, {
            type: "status",
            state: "completed",
            ts: Date.now(),
          });
        } else {
          throw new Error("Failed to send shipping confirmation");
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        sendSSEEvent(encoder, controller, {
          type: "error",
          ts: Date.now(),
          message: errorMessage,
          details: error instanceof Error ? { stack: error.stack } : undefined,
        });

        sendSSEEvent(encoder, controller, {
          type: "status",
          state: "error",
          message: errorMessage,
          ts: Date.now(),
        });
      } finally {
        crmClient.close();
        emailClient.close();
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}