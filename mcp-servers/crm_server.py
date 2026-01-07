"""
CRM MCP Server - Provides customer email lookup functionality.
Runs on port 8001 with SSE support for MCP protocol communication.
"""

import json
import logging
from typing import Any, Dict, Optional

from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse
import uvicorn

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Mock database
CUSTOMER_DB = {
    "XYZ-789": "alice@example.com",
    "ABC-123": "bob@example.com",
}

# FastAPI app
app = FastAPI(title="CRM MCP Server", version="1.0.0")


class MCPRequest(BaseModel):
    """MCP protocol request model."""
    jsonrpc: str = "2.0"
    id: Optional[str] = None
    method: str
    params: Optional[Dict[str, Any]] = None


class MCPResponse(BaseModel):
    """MCP protocol response model."""
    jsonrpc: str = "2.0"
    id: Optional[str] = None
    result: Optional[Any] = None
    error: Optional[Dict[str, Any]] = None


def create_mcp_response(request_id: Optional[str], result: Any = None, error: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Create a standardized MCP response."""
    response = {"jsonrpc": "2.0", "id": request_id}
    if result is not None:
        response["result"] = result
    if error is not None:
        response["error"] = error
    return response


def create_error_response(code: int, message: str, data: Any = None) -> Dict[str, Any]:
    """Create an MCP error response."""
    error = {"code": code, "message": message}
    if data is not None:
        error["data"] = data
    return error


async def handle_initialize(request_id: Optional[str], params: Dict[str, Any]) -> Dict[str, Any]:
    """Handle MCP initialize request."""
    logger.info("Handling initialize request")
    return create_mcp_response(
        request_id,
        result={
            "protocolVersion": "2024-11-05",
            "capabilities": {
                "tools": {
                    "listChanged": False
                }
            },
            "serverInfo": {
                "name": "crm-server",
                "version": "1.0.0"
            }
        }
    )


async def handle_tools_list(request_id: Optional[str], params: Dict[str, Any]) -> Dict[str, Any]:
    """Handle tools/list request."""
    logger.info("Handling tools/list request")
    return create_mcp_response(
        request_id,
        result={
            "tools": [
                {
                    "name": "getCustomerEmail",
                    "description": "Get customer email address by order ID",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "order_id": {
                                "type": "string",
                                "description": "The order ID to look up"
                            }
                        },
                        "required": ["order_id"]
                    }
                }
            ]
        }
    )


async def handle_tools_call(request_id: Optional[str], params: Dict[str, Any]) -> Dict[str, Any]:
    """Handle tools/call request."""
    tool_name = params.get("name")
    arguments = params.get("arguments", {})
    
    logger.info(f"Handling tools/call request for tool: {tool_name}, arguments: {arguments}")
    
    if tool_name == "getCustomerEmail":
        order_id = arguments.get("order_id")
        
        if not order_id:
            return create_mcp_response(
                request_id,
                error=create_error_response(
                    -32602,
                    "Invalid params",
                    "order_id is required"
                )
            )
        
        if order_id not in CUSTOMER_DB:
            return create_mcp_response(
                request_id,
                error=create_error_response(
                    -32603,
                    "Order not found",
                    f"No customer found for order_id: {order_id}"
                )
            )
        
        email = CUSTOMER_DB[order_id]
        return create_mcp_response(
            request_id,
            result={
                "content": [
                    {
                        "type": "text",
                        "text": json.dumps({"email": email})
                    }
                ]
            }
        )
    else:
        return create_mcp_response(
            request_id,
            error=create_error_response(
                -32601,
                "Method not found",
                f"Unknown tool: {tool_name}"
            )
        )


async def handle_request(request: MCPRequest) -> Dict[str, Any]:
    """Route MCP request to appropriate handler."""
    method = request.method
    params = request.params or {}
    
    handlers = {
        "initialize": handle_initialize,
        "tools/list": handle_tools_list,
        "tools/call": handle_tools_call,
    }
    
    if method in handlers:
        return await handlers[method](request.id, params)
    else:
        return create_mcp_response(
            request.id,
            error=create_error_response(
                -32601,
                "Method not found",
                f"Unknown method: {method}"
            )
        )


@app.get("/sse/")
async def sse_endpoint():
    """SSE endpoint for MCP protocol communication."""
    logger.info("SSE connection established")
    
    async def event_generator():
        # Send initialize notification
        yield {
            "event": "message",
            "data": json.dumps({
                "jsonrpc": "2.0",
                "method": "notifications/initialized"
            })
        }
    
    return EventSourceResponse(event_generator())


@app.post("/sse/messages/")
async def sse_messages(request: Request):
    """Handle MCP protocol messages via POST."""
    try:
        body = await request.json()
        logger.info(f"Received message: {body}")
        
        mcp_request = MCPRequest(**body)
        response = await handle_request(mcp_request)
        
        return response
    except Exception as e:
        logger.error(f"Error handling message: {e}")
        return create_mcp_response(
            body.get("id") if isinstance(body, dict) else None,
            error=create_error_response(
                -32700,
                "Parse error",
                str(e)
            )
        )


@app.get("/")
async def root():
    """Root endpoint for health check."""
    return {
        "name": "CRM MCP Server",
        "version": "1.0.0",
        "status": "running"
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)