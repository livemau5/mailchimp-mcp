import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  extractDataCenter,
  buildUrl,
  buildAuthHeader,
  formatResponse,
  formatError,
  summarizeWriteResponse,
} from "../utils.js";

const executeSchema = {
  method: z
    .enum(["GET", "POST", "PATCH", "PUT", "DELETE"])
    .describe("HTTP method"),
  path: z
    .string()
    .describe(
      'API path (e.g., "/lists", "/campaigns/{campaign_id}", "/lists/{list_id}/members")'
    ),
  body: z
    .record(z.unknown())
    .optional()
    .describe("Request body for POST/PATCH/PUT requests (JSON object)"),
  params: z
    .record(z.string())
    .optional()
    .describe(
      'Query parameters (e.g., { "count": "10", "offset": "0", "status": "subscribed" })'
    ),
  verbose: z
    .boolean()
    .optional()
    .describe(
      "Return full API response. By default, write operations (POST/PATCH/PUT/DELETE) return compact summaries to save context. Set verbose=true to get the full response."
    ),
};

export function registerExecuteTool(server: McpServer, apiKey: string): void {
  const dc = extractDataCenter(apiKey);
  const authHeader = buildAuthHeader(apiKey);

  server.tool(
    "execute",
    "Execute any Mailchimp Marketing API call. Use the search tool first to discover available endpoints and their parameters. Write operations return compact summaries by default — set verbose=true for full response.",
    executeSchema,
    async (params) => {
      const { method, path, body, params: queryParams, verbose } = params;

      const url = buildUrl(dc, path, queryParams);

      const fetchOptions: RequestInit = {
        method,
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
      };

      if (body && ["POST", "PATCH", "PUT"].includes(method)) {
        fetchOptions.body = JSON.stringify(body);
      }

      try {
        const response = await fetch(url, fetchOptions);
        const contentType = response.headers.get("content-type") ?? "";

        let data: unknown;
        if (contentType.includes("application/json")) {
          data = await response.json();
        } else {
          data = await response.text();
        }

        if (!response.ok) {
          return {
            content: [
              { type: "text", text: formatError(response.status, data) },
            ],
            isError: true,
          };
        }

        // Compact mode for write operations (unless verbose requested)
        if (!verbose && ["POST", "PATCH", "PUT", "DELETE"].includes(method)) {
          return {
            content: [
              {
                type: "text",
                text: summarizeWriteResponse(
                  data,
                  `${method} ${path} — Success.`
                ),
              },
            ],
          };
        }

        return {
          content: [{ type: "text", text: formatResponse(data) }],
        };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error occurred";
        return {
          content: [{ type: "text", text: `Connection error: ${message}` }],
          isError: true,
        };
      }
    }
  );
}
