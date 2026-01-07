# Autonomous Ops Agent - Web UI

Next.js web interface for the Autonomous Operations Agent using MCP (Model Context Protocol).

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Prerequisites

Before running the web UI, make sure the MCP servers are running:

- **CRM Server** on port 8001
- **Email Server** on port 8002

See the main [README](../README.md) for instructions on starting the MCP servers.

## Features

- Process orders using MCP tools
- Real-time log streaming via Server-Sent Events (SSE)
- Display order processing results
- Error handling and status updates

## Architecture

- **Frontend**: React with Next.js App Router
- **Backend**: Next.js API routes with Node.js runtime
- **MCP Client**: Custom TypeScript implementation using fetch() and ReadableStream for SSE

## Key Implementation Details

### Node.js Runtime
The API route uses `export const runtime = "nodejs"` to ensure it runs in Node.js runtime, not Edge runtime, which is required for the MCP client implementation.

### SSE Implementation
The MCP client uses native Node.js APIs (fetch, ReadableStream, TextDecoder) instead of the browser-only EventSource API. This allows the server-side code to connect to MCP servers via SSE without requiring additional polyfills.

### Server-Side MCP Access
All MCP connections are handled server-side in the API route, avoiding CORS issues that would occur with client-side connections.