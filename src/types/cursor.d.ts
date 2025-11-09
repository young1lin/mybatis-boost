/**
 * Type definitions for Cursor IDE MCP Extension API
 * Reference: https://docs.cursor.com/context/mcp
 */

declare module 'vscode' {
    export namespace cursor {
        export namespace mcp {
            /**
             * Stdio server configuration for MCP
             */
            export interface StdioServerConfig {
                name: string;
                server: {
                    command: string;
                    args: string[];
                    env: Record<string, string>;
                };
            }

            /**
             * Remote server configuration for MCP
             */
            export interface RemoteServerConfig {
                name: string;
                server: {
                    url: string;
                    headers?: Record<string, string>;
                };
            }

            /**
             * MCP server configuration union type
             */
            export type ExtMCPServerConfig = StdioServerConfig | RemoteServerConfig;

            /**
             * Register an MCP server
             * @param config Server configuration
             */
            export const registerServer: (config: ExtMCPServerConfig) => void;

            /**
             * Unregister an MCP server
             * @param serverName Name of the server to unregister
             */
            export const unregisterServer: (serverName: string) => void;
        }
    }
}

export {};
