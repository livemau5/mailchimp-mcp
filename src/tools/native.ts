import { z } from "zod";
import { createHash } from "crypto";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  extractDataCenter,
  buildUrl,
  buildAuthHeader,
  formatResponse,
  formatError,
} from "../utils.js";

function subscriberHash(email: string): string {
  return createHash("md5").update(email.toLowerCase().trim()).digest("hex");
}

async function mc(
  dc: string,
  auth: string,
  method: string,
  path: string,
  params?: Record<string, string>,
  body?: unknown
): Promise<{ text: string; isError?: boolean }> {
  const url = buildUrl(dc, path, params);
  const opts: RequestInit = {
    method,
    headers: { Authorization: auth, "Content-Type": "application/json" },
  };
  if (body && ["POST", "PATCH", "PUT"].includes(method)) {
    opts.body = JSON.stringify(body);
  }
  try {
    const res = await fetch(url, opts);
    const ct = res.headers.get("content-type") ?? "";
    const data = ct.includes("json") ? await res.json() : await res.text();
    if (!res.ok) return { text: formatError(res.status, data), isError: true };
    return { text: formatResponse(data) };
  } catch (err) {
    return {
      text: `Connection error: ${err instanceof Error ? err.message : String(err)}`,
      isError: true,
    };
  }
}

export function registerNativeTools(server: McpServer, apiKey: string): void {
  const dc = extractDataCenter(apiKey);
  const auth = buildAuthHeader(apiKey);

  // 1. List Audiences
  server.tool(
    "list_audiences",
    "List all audiences (lists) with subscriber counts and key stats.",
    {
      count: z.number().min(1).max(100).default(10).optional().describe("Number of audiences to return (default 10)"),
    },
    async ({ count = 10 }) => {
      const r = await mc(dc, auth, "GET", "/lists", {
        count: String(count),
        fields: "lists.id,lists.name,lists.stats.member_count,lists.stats.unsubscribe_count,lists.stats.open_rate,lists.stats.click_rate,lists.date_created,total_items",
      });
      return { content: [{ type: "text" as const, text: r.text }], isError: r.isError };
    }
  );

  // 2. List Campaigns
  server.tool(
    "list_campaigns",
    "List email campaigns, optionally filtered by status (save, paused, schedule, sending, sent).",
    {
      status: z.enum(["save", "paused", "schedule", "sending", "sent"]).optional().describe("Filter by campaign status"),
      count: z.number().min(1).max(100).default(10).optional().describe("Number of campaigns to return (default 10)"),
      offset: z.number().min(0).default(0).optional().describe("Pagination offset"),
    },
    async ({ status, count = 10, offset = 0 }) => {
      const params: Record<string, string> = {
        count: String(count),
        offset: String(offset),
        fields: "campaigns.id,campaigns.settings.title,campaigns.settings.subject_line,campaigns.status,campaigns.send_time,campaigns.emails_sent,campaigns.report_summary,total_items",
      };
      if (status) params.status = status;
      const r = await mc(dc, auth, "GET", "/campaigns", params);
      return { content: [{ type: "text" as const, text: r.text }], isError: r.isError };
    }
  );

  // 3. Create Campaign
  server.tool(
    "create_campaign",
    "Create a new email campaign. Returns the campaign ID for use with update_campaign_content and send/schedule.",
    {
      list_id: z.string().describe("Audience/list ID to send to"),
      subject: z.string().describe("Email subject line"),
      title: z.string().optional().describe("Internal campaign title (defaults to subject)"),
      from_name: z.string().describe("The 'from' name on the email"),
      reply_to: z.string().describe("Reply-to email address"),
      preview_text: z.string().optional().describe("Preview text shown in inbox"),
      segment_id: z.number().optional().describe("Segment ID to send to (subset of audience)"),
    },
    async ({ list_id, subject, title, from_name, reply_to, preview_text, segment_id }) => {
      const body: Record<string, unknown> = {
        type: "regular",
        recipients: { list_id },
        settings: {
          subject_line: subject,
          title: title ?? subject,
          from_name,
          reply_to,
        },
      };
      if (preview_text) (body.settings as Record<string, unknown>).preview_text = preview_text;
      if (segment_id) (body.recipients as Record<string, unknown>).segment_opts = { saved_segment_id: segment_id };
      const r = await mc(dc, auth, "POST", "/campaigns", undefined, body);
      return { content: [{ type: "text" as const, text: r.text }], isError: r.isError };
    }
  );

  // 4. Update Campaign Content
  server.tool(
    "update_campaign_content",
    "Set the HTML content or template for a campaign. Provide either html OR template_id.",
    {
      campaign_id: z.string().describe("Campaign ID"),
      html: z.string().optional().describe("Full HTML content for the email"),
      template_id: z.number().optional().describe("Template ID to use instead of raw HTML"),
    },
    async ({ campaign_id, html, template_id }) => {
      const body: Record<string, unknown> = {};
      if (html) body.html = html;
      if (template_id) body.template = { id: template_id };
      const r = await mc(dc, auth, "PUT", `/campaigns/${campaign_id}/content`, undefined, body);
      return { content: [{ type: "text" as const, text: r.text }], isError: r.isError };
    }
  );

  // 5. Schedule Campaign
  server.tool(
    "schedule_campaign",
    "Schedule a campaign to send at a specific time.",
    {
      campaign_id: z.string().describe("Campaign ID"),
      schedule_time: z.string().describe("Send time in ISO 8601 format (e.g., '2026-03-15T10:00:00+00:00')"),
    },
    async ({ campaign_id, schedule_time }) => {
      const r = await mc(dc, auth, "POST", `/campaigns/${campaign_id}/actions/schedule`, undefined, {
        schedule_time,
      });
      return { content: [{ type: "text" as const, text: r.text }], isError: r.isError };
    }
  );

  // 6. Send Campaign
  server.tool(
    "send_campaign",
    "Send a campaign immediately. The campaign must have content set first via update_campaign_content.",
    {
      campaign_id: z.string().describe("Campaign ID to send"),
    },
    async ({ campaign_id }) => {
      const r = await mc(dc, auth, "POST", `/campaigns/${campaign_id}/actions/send`);
      return { content: [{ type: "text" as const, text: r.text }], isError: r.isError };
    }
  );

  // 7. Get Campaign Report
  server.tool(
    "get_campaign_report",
    "Get performance report for a sent campaign: opens, clicks, bounces, unsubscribes, and more.",
    {
      campaign_id: z.string().describe("Campaign ID"),
    },
    async ({ campaign_id }) => {
      const r = await mc(dc, auth, "GET", `/reports/${campaign_id}`, {
        fields: "id,campaign_title,subject_line,emails_sent,opens.opens_total,opens.unique_opens,opens.open_rate,clicks.clicks_total,clicks.unique_clicks,clicks.click_rate,bounces.hard_bounces,bounces.soft_bounces,unsubscribed,send_time,list_id",
      });
      return { content: [{ type: "text" as const, text: r.text }], isError: r.isError };
    }
  );

  // 8. List Templates
  server.tool(
    "list_templates",
    "List available email templates.",
    {
      type: z.enum(["user", "gallery"]).optional().describe("Filter by template type: 'user' (yours) or 'gallery' (Mailchimp's)"),
      count: z.number().min(1).max(100).default(20).optional().describe("Number of templates to return (default 20)"),
    },
    async ({ type, count = 20 }) => {
      const params: Record<string, string> = {
        count: String(count),
        fields: "templates.id,templates.name,templates.type,templates.date_created,templates.date_edited,total_items",
      };
      if (type) params.type = type;
      const r = await mc(dc, auth, "GET", "/templates", params);
      return { content: [{ type: "text" as const, text: r.text }], isError: r.isError };
    }
  );

  // 9. Search Members
  server.tool(
    "search_members",
    "Search for audience members by name or email address across all audiences.",
    {
      query: z.string().describe("Search query (name or email address)"),
      list_id: z.string().optional().describe("Limit search to a specific audience/list ID"),
    },
    async ({ query, list_id }) => {
      const params: Record<string, string> = { query };
      if (list_id) params.list_id = list_id;
      const r = await mc(dc, auth, "GET", "/search-members", params);
      return { content: [{ type: "text" as const, text: r.text }], isError: r.isError };
    }
  );

  // 10. Add or Update Member
  server.tool(
    "add_or_update_member",
    "Add a new subscriber or update an existing one (upsert). Automatically computes the required subscriber hash from the email.",
    {
      list_id: z.string().describe("Audience/list ID"),
      email: z.string().describe("Subscriber email address"),
      status: z.enum(["subscribed", "unsubscribed", "cleaned", "pending", "transactional"]).optional().describe("Subscription status (default: subscribed for new, unchanged for existing)"),
      merge_fields: z.record(z.string()).optional().describe('Merge fields like { "FNAME": "Jane", "LNAME": "Doe" }'),
      tags: z.array(z.string()).optional().describe('Tags to add, e.g., ["VIP", "2026-campaign"]'),
    },
    async ({ list_id, email, status, merge_fields, tags }) => {
      const hash = subscriberHash(email);
      const body: Record<string, unknown> = {
        email_address: email,
        status_if_new: status ?? "subscribed",
      };
      if (status) body.status = status;
      if (merge_fields) body.merge_fields = merge_fields;
      const r = await mc(dc, auth, "PUT", `/lists/${list_id}/members/${hash}`, undefined, body);

      // If tags provided, apply them in a separate call
      if (tags && tags.length > 0 && !r.isError) {
        const tagBody = { tags: tags.map((t) => ({ name: t, status: "active" })) };
        await mc(dc, auth, "POST", `/lists/${list_id}/members/${hash}/tags`, undefined, tagBody);
      }

      return { content: [{ type: "text" as const, text: r.text }], isError: r.isError };
    }
  );
}
