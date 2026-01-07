import "server-only";

/**
 * MCP Client for connecting to Python MCP servers via SSE.
 * Implements JSON-RPC 2.0 protocol for tool calls.
 */

interface JSONRPCRequest {
  jsonrpc: "2.0";
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

interface JSONRPCResponse {
  jsonrpc: "2.0";
  id: string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required: string[];
  };
}

interface MCPToolResult {
  content: Array<{
    type: string;
    text: string;
  }>;
}

type PendingRequest = {
  resolve: (value: JSONRPCResponse) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
};

/**
 * SSE Event parser for Node.js using ReadableStream
 */
class SSEParser {
  private buffer = "";
  private onMessage: (data: string) => void;

  constructor(onMessage: (data: string) => void) {
    this.onMessage = onMessage;
  }

  /**
   * Parse a chunk of data from the SSE stream
   */
  parse(chunk: string): void {
    this.buffer += chunk;
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() || ""; // Keep the last incomplete line in buffer

    let currentData = "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === "") {
        // Empty line marks the end of an event
        if (currentData) {
          this.onMessage(currentData);
          currentData = "";
        }
      } else if (trimmed.startsWith("data:")) {
        currentData = trimmed.substring(5).trim();
      }
    }
  }
}

/**
 * MCP Client class for connecting to MCP servers via SSE.
 */
export class MCPClient {
  private baseUrl: string;
  private sseController: AbortController | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private requestIdCounter = 0;
  private connected = false;
  private connectTimeout = 10000; // 10 seconds
  private requestTimeout = 10000; // 10 seconds

  constructor(url: string) {
    // Remove trailing slashes and ensure we have the base URL
    // The URL should be the base server URL (e.g., http://127.0.0.1:8001)
    // We'll add /sse to it
    this.baseUrl = url.replace(/\/+$/, "");
  }

  /**
   * Connect to the SSE endpoint.
   */
  async connect(): Promise<void> {
    if (this.connected) {
      throw new Error("Already connected to MCP server");
    }

    const sseUrl = `${this.baseUrl}/sse/`;

    try {
      // First, verify the server is accessible
      const healthCheck = await this.fetchWithTimeout(
        `${this.baseUrl}/`,
        { method: "GET" },
        this.connectTimeout
      );

      if (!healthCheck.ok) {
        throw new Error(
          `Server health check failed: ${healthCheck.status} ${healthCheck.statusText}`
        );
      }

      // Initialize the connection by sending an initialize request
      const initResponse = await this.sendRequest("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: {
          name: "mcp-client-ts",
          version: "1.0.0",
        },
      });

      if (initResponse.error) {
        throw new Error(
          `Initialize failed: ${initResponse.error.message} (${initResponse.error.code})`
        );
      }

      // Set up SSE connection for receiving notifications using fetch
      this.sseController = new AbortController();
      const parser = new SSEParser((data) => {
        try {
          const parsed = JSON.parse(data);
          // Handle notifications (no id field)
          if (!parsed.id && parsed.method) {
            console.log("Received notification:", parsed.method);
          }
        } catch (e) {
          console.error("Failed to parse SSE message:", e);
        }
      });

      // Start the SSE stream in the background
      this.startSSEStream(sseUrl, parser).catch((error) => {
        console.error("SSE stream error:", error);
        this.close();
      });

      this.connected = true;
    } catch (error) {
      this.close();
      throw error instanceof Error
        ? error
        : new Error(`Connection failed: ${String(error)}`);
    }
  }

  /**
   * Start the SSE stream using fetch and ReadableStream
   */
  private async startSSEStream(
    url: string,
    parser: SSEParser
  ): Promise<void> {
    if (!this.sseController) {
      throw new Error("No abort controller available");
    }

    const response = await fetch(url, {
      headers: {
        Accept: "text/event-stream",
      },
      signal: this.sseController.signal,
    });

    if (!response.ok) {
      throw new Error(
        `SSE connection failed: ${response.status} ${response.statusText}`
      );
    }

    if (!response.body) {
      throw new Error("Response body is null");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        const chunk = decoder.decode(value, { stream: true });
        parser.parse(chunk);
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * List available tools from the MCP server.
   */
  async listTools(): Promise<MCPTool[]> {
    if (!this.connected) {
      throw new Error("Not connected to MCP server. Call connect() first.");
    }

    const response = await this.sendRequest("tools/list", {});

    if (response.error) {
      throw new Error(
        `Failed to list tools: ${response.error.message} (${response.error.code})`
      );
    }

    const result = response.result as { tools: MCPTool[] };
    return result.tools || [];
  }

  /**
   * Call a tool on the MCP server.
   */
  async callTool(toolName: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    if (!this.connected) {
      throw new Error("Not connected to MCP server. Call connect() first.");
    }

    const response = await this.sendRequest("tools/call", {
      name: toolName,
      arguments: args,
    });

    if (response.error) {
      const errorMessage = response.error.data
        ? `${response.error.message}: ${String(response.error.data)}`
        : response.error.message;
      throw new Error(`Tool call failed: ${errorMessage} (${response.error.code})`);
    }

    return response.result as MCPToolResult;
  }

  /**
   * Send a JSON-RPC request to the MCP server.
   */
  private async sendRequest(
    method: string,
    params: Record<string, unknown>
  ): Promise<JSONRPCResponse> {
    const requestId = this.generateRequestId();
    const request: JSONRPCRequest = {
      jsonrpc: "2.0",
      id: requestId,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request timeout after ${this.requestTimeout}ms`));
      }, this.requestTimeout);

      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      this.postMessage(request).catch((error) => {
        clearTimeout(timeout);
        this.pendingRequests.delete(requestId);
        reject(error);
      });
    });
  }

  /**
   * Post a message to the MCP server.
   */
  private async postMessage(request: JSONRPCRequest): Promise<void> {
    const messagesUrl = `${this.baseUrl}/sse/messages/`;

    try {
      const response = await this.fetchWithTimeout(
        messagesUrl,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(request),
        },
        this.requestTimeout
      );

      if (!response.ok) {
        throw new Error(
          `HTTP error: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as JSONRPCResponse;

      // Resolve the pending request
      const pending = this.pendingRequests.get(request.id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(request.id);
        pending.resolve(data);
      }
    } catch (error) {
      throw error instanceof Error
        ? error
        : new Error(`Failed to send message: ${String(error)}`);
    }
  }

  /**
   * Fetch with timeout support.
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Request timeout after ${timeoutMs}ms`);
      }
      throw error;
    }
  }

  /**
   * Generate a unique request ID.
   */
  private generateRequestId(): string {
    return `req_${++this.requestIdCounter}_${Date.now()}`;
  }

  /**
   * Close the connection to the MCP server.
   */
  close(): void {
    // Clear all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Connection closed"));
    }
    this.pendingRequests.clear();

    // Close SSE connection
    if (this.sseController) {
      this.sseController.abort();
      this.sseController = null;
    }

    this.connected = false;
  }

  /**
   * Check if the client is connected.
   */
  isConnected(): boolean {
    return this.connected;
  }
}