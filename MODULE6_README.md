# Module 6: The Ecosystem - The Future of Agent Architecture

## Overview

This module demonstrates the **Model Context Protocol (MCP)** - a standard protocol for connecting AI agents to external tools and systems. Think of MCP as the "USB-C for Agents" - a universal standard that eliminates the "Tower of Babel" problem where every API and tool is different.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    HOST (The Agent)                          │
│              autonomous-ops-agent/host_agent.py              │
│                                                               │
│  Uses OpenAI SDK to orchestrate calls to MCP servers         │
└────────────────────┬────────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│  CRM Server     │     │  Email Server   │
│  Port 8001      │     │  Port 8002      │
│                 │     │                 │
│  Tool:          │     │  Tool:          │
│  getCustomer    │     │  sendShipping   │
│  Email(order_id)│     │  Confirmation   │
└─────────────────┘     └─────────────────┘
```

## Components

### 1. MCP Servers (The "Plugs")

#### CRM Server (`mcp-servers/crm_server.py`)
- **Port:** 8001
- **Tool:** `getCustomerEmail(order_id)` - Get customer email by order ID
- **Mock Data:**
  - Order `XYZ-789` → `alice@example.com`
  - Order `ABC-123` → `bob@example.com`

#### Email Server (`mcp-servers/email_server.py`)
- **Port:** 8002
- **Tool:** `sendShippingConfirmation(email, order_details)` - Send shipping confirmation email

### 2. Host Agent (`host_agent.py`)
- The application that uses MCP servers
- Uses OpenAI SDK for orchestration
- Processes orders autonomously by calling tools from multiple servers

### 3. TypeScript MCP Client (`web/src/lib/mcp-client.ts`)
- Alternative client implementation for Node.js/TypeScript environments
- Can be used in web applications

## Setup Instructions

### Prerequisites

1. Python 3.10+
2. OpenAI API key

### Install Dependencies

```bash
# Install MCP server dependencies
cd mcp-servers
pip install -r requirements.txt

# Install Host agent dependencies
cd ..
pip install -r requirements.txt
```

### Set Environment Variables

```bash
# Set your OpenAI API key
export OPENAI_API_KEY="your-api-key-here"
```

## Running the Demo

### Step 1: Start the MCP Servers

Open three separate terminal windows:

**Terminal 1 - CRM Server:**
```bash
cd mcp-servers
python crm_server.py
```

**Terminal 2 - Email Server:**
```bash
cd mcp-servers
python email_server.py
```

### Step 2: Run the Host Agent

**Terminal 3 - Host Agent:**
```bash
python host_agent.py
```

### Expected Output

```
INFO - Connecting to crm at http://127.0.0.1:8001/sse/
INFO - Connected to crm: {'name': 'crm-server', 'version': '1.0.0'}
INFO - crm available tools: ['getCustomerEmail']
INFO - Connecting to email at http://127.0.0.1:8002/sse/
INFO - Connected to email: {'name': 'email-server', 'version': '1.0.0'}
INFO - email available tools: ['sendShippingConfirmation']
INFO - === Processing order #XYZ-789 ===
INFO - --- Iteration 1 ---
INFO - Executing tool: crm_getCustomerEmail
INFO - crm: Calling tool 'getCustomerEmail' with args: {'order_id': 'XYZ-789'}
INFO - crm: Tool result: {'email': 'alice@example.com'}
INFO - --- Iteration 2 ---
INFO - Executing tool: email_sendShippingConfirmation
INFO - email: Calling tool 'sendShippingConfirmation' with args: {'email': 'alice@example.com', 'order_details': {'order_id': 'XYZ-789'}}
INFO - email: Tool result: {'ok': True, 'message': 'Sent confirmation to alice@example.com for order XYZ-789'}
INFO - Agent finished processing
INFO - === Order #XYZ-789 processing complete ===

============================================================
ORDER PROCESSING RESULT
============================================================
Order ID: XYZ-789
Status: completed
Iterations: 2

Summary:
I have successfully processed order #XYZ-789:
1. Retrieved customer email (alice@example.com) from the CRM system
2. Sent shipping confirmation email to the customer

============================================================
```

## How It Works

### The MCP Protocol Flow

1. **Connection:** Host connects to MCP server via SSE endpoint (`/sse/`)
2. **Initialization:** Host sends `initialize` request with protocol version
3. **Tool Discovery:** Host calls `tools/list` to get available tools
4. **Tool Execution:** Host calls `tools/call` with tool name and arguments
5. **Response:** Server returns JSON-RPC 2.0 response with result or error

### JSON-RPC 2.0 Format

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "tools/call",
  "params": {
    "name": "getCustomerEmail",
    "arguments": {
      "order_id": "XYZ-789"
    }
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"email\": \"alice@example.com\"}"
      }
    ]
  }
}
```

## Key Concepts

### The "Tower of Babel" Problem
Every API and tool is different - different authentication, different request formats, different response structures. This makes it hard for agents to work with multiple systems.

### MCP Solution
MCP provides a **standard protocol** that:
- Wraps any tool (database, API, file system) in a consistent interface
- Uses JSON-RPC 2.0 for communication
- Supports SSE for real-time notifications
- Is framework-agnostic

### Analogy
We don't need a different plug for our "database lamp" and our "email toaster." We just plug both into the MCP "wall socket."

## Business Applicability

This is the blueprint for automating complex backend operations - essentially "Zapier on steroids" but with AI intelligence.

**Use Cases:**
- Order processing across multiple systems
- Customer onboarding workflows
- Data synchronization between systems
- Automated reporting and notifications

## Extending the Demo

### Adding a New MCP Server

1. Create a new server file (e.g., `inventory_server.py`)
2. Implement the MCP protocol endpoints:
   - `GET /sse/` - SSE endpoint
   - `POST /sse/messages/` - JSON-RPC message handler
3. Add tools to the server
4. Connect the host agent to the new server

### Example: Adding an Inventory Server

```python
# In host_agent.py
await agent.add_server("inventory", "http://127.0.0.1:8003/sse")
```

The agent automatically discovers and uses the new tools without any code changes!

## Debrief

We just built a **future-proof, decoupled agent architecture**. Key benefits:

1. **Modularity:** Each business system is wrapped in its own MCP server
2. **Interchangeability:** Swap out the Email Server for any other, and the agent doesn't need to be rewritten
3. **Scalability:** Add new systems by adding new MCP servers
4. **Standardization:** All tools use the same MCP protocol
5. **AI-Native:** Designed from the ground up for AI agents

## Troubleshooting

### Server won't start
- Check if port is already in use
- Verify dependencies are installed

### Host agent can't connect
- Ensure both MCP servers are running
- Check firewall settings
- Verify URLs are correct

### OpenAI API errors
- Verify `OPENAI_API_KEY` is set
- Check API key has credits available

## Resources

- [MCP Specification](https://modelcontextprotocol.io/)
- [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling)
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)