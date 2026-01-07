"""
Autonomous Operations Agent - Host
Processes customer orders by interacting with multiple MCP servers.

This is the "Host" in the MCP architecture - the application that uses
MCP servers to access tools and data from different business systems.
"""

import asyncio
import json
import logging
from typing import Any, Dict, List, Optional

import httpx
from openai import AsyncOpenAI

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


class MCPServerClient:
    """Client for connecting to an MCP server."""

    def __init__(self, name: str, base_url: str):
        self.name = name
        self.base_url = base_url.rstrip("/")
        self.sse_url = f"{self.base_url}/sse/"
        self.messages_url = f"{self.base_url}/sse/messages/"
        self.request_id = 0
        self.tools: List[Dict[str, Any]] = []

    async def connect(self) -> None:
        """Connect to the MCP server and initialize."""
        logger.info(f"Connecting to {self.name} at {self.sse_url}")

        # Health check
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{self.base_url}/", timeout=5.0)
            if response.status_code != 200:
                raise Exception(f"{self.name} health check failed: {response.status_code}")

        # Initialize
        init_response = await self._send_request("initialize", {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {
                "name": "autonomous-ops-agent",
                "version": "1.0.0"
            }
        })

        if "error" in init_response:
            raise Exception(f"{self.name} initialize failed: {init_response['error']}")

        logger.info(f"Connected to {self.name}: {init_response.get('result', {}).get('serverInfo', {})}")

        # List tools
        tools_response = await self._send_request("tools/list", {})
        if "error" in tools_response:
            raise Exception(f"{self.name} tools/list failed: {tools_response['error']}")

        self.tools = tools_response.get("result", {}).get("tools", [])
        logger.info(f"{self.name} available tools: {[t['name'] for t in self.tools]}")

    async def _send_request(self, method: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Send a JSON-RPC request to the MCP server."""
        self.request_id += 1
        request = {
            "jsonrpc": "2.0",
            "id": str(self.request_id),
            "method": method,
            "params": params
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                self.messages_url,
                json=request,
                headers={"Content-Type": "application/json"}
            )
            response.raise_for_status()
            return response.json()

    async def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Call a tool on the MCP server."""
        logger.info(f"{self.name}: Calling tool '{tool_name}' with args: {arguments}")

        response = await self._send_request("tools/call", {
            "name": tool_name,
            "arguments": arguments
        })

        if "error" in response:
            logger.error(f"{self.name}: Tool call failed: {response['error']}")
            return {"error": response["error"]}

        result = response.get("result", {})
        # Parse the content from the tool result
        if "content" in result and len(result["content"]) > 0:
            content_text = result["content"][0].get("text", "{}")
            try:
                parsed = json.loads(content_text)
                logger.info(f"{self.name}: Tool result: {parsed}")
                return parsed
            except json.JSONDecodeError:
                logger.info(f"{self.name}: Tool result (raw): {content_text}")
                return {"raw": content_text}

        return result

    def get_openai_tool_definitions(self) -> List[Dict[str, Any]]:
        """Get OpenAI function calling definitions for this server's tools."""
        definitions = []
        for tool in self.tools:
            definitions.append({
                "type": "function",
                "function": {
                    "name": f"{self.name}_{tool['name']}",
                    "description": f"[{self.name}] {tool['description']}",
                    "parameters": tool["inputSchema"]
                }
            })
        return definitions


class AutonomousOpsAgent:
    """
    The Host agent that processes orders using MCP servers.

    This agent uses the OpenAI SDK to orchestrate calls to multiple
    MCP servers (CRM, Email) to process customer orders autonomously.
    """

    def __init__(self, openai_api_key: str):
        self.client = AsyncOpenAI(api_key=openai_api_key)
        self.servers: Dict[str, MCPServerClient] = {}
        self.tool_mapping: Dict[str, tuple[str, str]] = {}  # Maps OpenAI tool name to (server_name, tool_name)

    async def add_server(self, name: str, url: str) -> None:
        """Add an MCP server to the agent."""
        server = MCPServerClient(name, url)
        await server.connect()
        self.servers[name] = server

        # Build tool mapping
        for tool in server.tools:
            openai_tool_name = f"{name}_{tool['name']}"
            self.tool_mapping[openai_tool_name] = (name, tool['name'])

    async def process_order(self, order_id: str) -> Dict[str, Any]:
        """
        Process a customer order autonomously.

        The agent will:
        1. Get customer email from CRM server
        2. Send shipping confirmation via Email server
        """
        logger.info(f"=== Processing order #{order_id} ===")

        # Get all tool definitions
        all_tools = []
        for server in self.servers.values():
            all_tools.extend(server.get_openai_tool_definitions())

        # System prompt for the agent
        system_prompt = """You are an Autonomous Operations Agent that processes customer orders.

You have access to the following tools via MCP servers:
- CRM Server: Get customer email by order ID
- Email Server: Send shipping confirmation emails

When processing an order:
1. First, get the customer's email using the CRM server
2. Then, send a shipping confirmation using the Email server

Be thorough and complete all necessary steps. Report your progress clearly."""

        # Initial user message
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Process new order #{order_id}."}
        ]

        # Process the order with tool calls
        max_iterations = 10
        iteration = 0

        while iteration < max_iterations:
            iteration += 1
            logger.info(f"--- Iteration {iteration} ---")

            # Get completion from OpenAI
            response = await self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                tools=all_tools,
                tool_choice="auto"
            )

            message = response.choices[0].message
            messages.append({"role": "assistant", "content": message.content or ""})

            # Check if the agent wants to call tools
            if not message.tool_calls:
                logger.info("Agent finished processing")
                break

            # Execute tool calls
            for tool_call in message.tool_calls:
                function_name = tool_call.function.name
                function_args = json.loads(tool_call.function.arguments)

                logger.info(f"Executing tool: {function_name}")

                # Map OpenAI tool name to MCP server and tool
                if function_name not in self.tool_mapping:
                    error_msg = f"Unknown tool: {function_name}"
                    logger.error(error_msg)
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": json.dumps({"error": error_msg})
                    })
                    continue

                server_name, tool_name = self.tool_mapping[function_name]
                server = self.servers[server_name]

                # Call the tool on the MCP server
                try:
                    result = await server.call_tool(tool_name, function_args)
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": json.dumps(result)
                    })
                except Exception as e:
                    error_msg = f"Tool execution failed: {str(e)}"
                    logger.error(error_msg)
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": json.dumps({"error": error_msg})
                    })

        # Get final summary
        final_response = await self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages
        )

        logger.info(f"=== Order #{order_id} processing complete ===")
        return {
            "order_id": order_id,
            "status": "completed",
            "summary": final_response.choices[0].message.content,
            "iterations": iteration
        }

    async def close(self) -> None:
        """Clean up resources."""
        logger.info("Shutting down agent")


async def main():
    """Main entry point for the Autonomous Operations Agent."""
    import os

    # Get OpenAI API key from environment
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        logger.error("OPENAI_API_KEY environment variable not set")
        return

    # Create the agent
    agent = AutonomousOpsAgent(api_key)

    try:
        # Connect to MCP servers
        await agent.add_server("crm", "http://127.0.0.1:8001/sse")
        await agent.add_server("email", "http://127.0.0.1:8002/sse")

        # Process an order
        result = await agent.process_order("XYZ-789")

        print("\n" + "=" * 60)
        print("ORDER PROCESSING RESULT")
        print("=" * 60)
        print(f"Order ID: {result['order_id']}")
        print(f"Status: {result['status']}")
        print(f"Iterations: {result['iterations']}")
        print(f"\nSummary:\n{result['summary']}")
        print("=" * 60)

    except Exception as e:
        logger.error(f"Error processing order: {e}", exc_info=True)
    finally:
        await agent.close()


if __name__ == "__main__":
    asyncio.run(main())