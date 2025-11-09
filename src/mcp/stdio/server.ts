/**
 * stdio-based MCP server for MyBatis Boost
 * Supports Cursor IDE and other MCP-compatible AI tools
 *
 * This server implements the Model Context Protocol (MCP) specification
 * using JSON-RPC 2.0 over stdio transport
 */

import * as readline from 'readline';
import { MCPRequestHandler } from './handlers';

/**
 * JSON-RPC 2.0 request structure
 */
interface JsonRpcRequest {
    jsonrpc: '2.0';
    id?: string | number | null;
    method: string;
    params?: any;
}

/**
 * JSON-RPC 2.0 response structure (success)
 */
interface JsonRpcSuccessResponse {
    jsonrpc: '2.0';
    id: string | number;
    result: any;
}

/**
 * JSON-RPC 2.0 response structure (error)
 * Note: Cursor IDE's Zod validation requires id to be string | number (not null)
 * Use sentinel value -1 for parse errors where id cannot be determined
 */
interface JsonRpcErrorResponse {
    jsonrpc: '2.0';
    id: string | number;
    error: {
        code: number;
        message: string;
        data?: any;
    };
}

type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse;

/**
 * MCP stdio server
 */
class MCPStdioServer {
    private handler: MCPRequestHandler;
    private rl: readline.Interface;

    constructor() {
        this.handler = new MCPRequestHandler();
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: false
        });
    }

    /**
     * Start the server
     */
    start(): void {
        this.logToStderr('MyBatis Boost MCP Server starting...');

        // Handle each line from stdin
        this.rl.on('line', async (line: string) => {
            try {
                const request: JsonRpcRequest = JSON.parse(line);
                const response = await this.handleRequest(request);
                this.sendResponse(response);
            } catch (error) {
                this.logToStderr(`Error processing request: ${error}`);
                // Send error response with sentinel id (-1) for parse errors
                // Cursor's Zod validation doesn't accept null id even for error responses
                this.sendResponse({
                    jsonrpc: '2.0',
                    id: -1,
                    error: {
                        code: -32700,
                        message: 'Parse error',
                        data: error instanceof Error ? error.message : String(error)
                    }
                });
            }
        });

        this.rl.on('close', () => {
            this.logToStderr('MCP Server shutting down...');
            process.exit(0);
        });

        this.logToStderr('MCP Server ready to accept requests');
    }

    /**
     * Handle JSON-RPC request
     */
    private async handleRequest(request: JsonRpcRequest): Promise<JsonRpcResponse | null> {
        const { id, method, params } = request;

        // If no id, this is a notification - don't send response
        if (id === undefined || id === null) {
            this.logToStderr(`Received notification: ${method}`);
            return null;
        }

        try {
            // Handle different MCP methods
            let result: any;

            switch (method) {
                case 'initialize':
                    result = await this.handler.handleInitialize(params);
                    break;

                case 'tools/list':
                    result = await this.handler.handleToolsList();
                    break;

                case 'tools/call':
                    result = await this.handler.handleToolCall(params);
                    break;

                default:
                    throw new Error(`Method not found: ${method}`);
            }

            return {
                jsonrpc: '2.0',
                id: id,
                result
            };

        } catch (error: any) {
            return {
                jsonrpc: '2.0',
                id: id,
                error: {
                    code: error.code || -32603,
                    message: error.message || 'Internal error',
                    data: error.data
                }
            };
        }
    }

    /**
     * Send response to stdout
     * Handles null responses (for notifications that don't need responses)
     */
    private sendResponse(response: JsonRpcResponse | null): void {
        if (response !== null) {
            console.log(JSON.stringify(response));
        }
    }

    /**
     * Log to stderr (stdout is reserved for JSON-RPC responses)
     */
    private logToStderr(message: string): void {
        console.error(`[MCP Server] ${message}`);
    }
}

// Start the server if run directly
if (require.main === module) {
    const server = new MCPStdioServer();
    server.start();
}

export { MCPStdioServer };
