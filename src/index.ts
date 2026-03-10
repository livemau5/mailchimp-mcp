#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerSearchTool } from "./tools/search.js";
import { registerExecuteTool } from "./tools/execute.js";
import { registerNativeTools } from "./tools/native.js";

const apiKey = process.env.MAILCHIMP_API_KEY;
if (!apiKey) {
  console.error(
    "Error: MAILCHIMP_API_KEY environment variable is required.\n" +
      'Format: "your-api-key-us12" (the suffix after the dash is your data center)'
  );
  process.exit(1);
}

const server = new McpServer({
  name: "mailchimp-mcp",
  version: "1.0.0",
});

registerNativeTools(server, apiKey);
registerSearchTool(server);
registerExecuteTool(server, apiKey);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Mailchimp MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
