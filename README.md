# mailchimp-mcp

**12 tools. 282 endpoints. Zero bloat.**

A hybrid Mailchimp MCP server: 10 native tools for the email campaign workflow you use every day, plus `search` and `execute` for full access to all 282 Marketing API endpoints. Inspired by [Cloudflare's Code Mode](https://developers.cloudflare.com/agents/guides/remote-mcp-server/) architecture.

## Why?

Every other Mailchimp MCP server exposes 40–50+ individual tools. Each tool definition eats tokens in the LLM context on every turn — even when you're not using Mailchimp. We use the hybrid approach from [Cloudflare's Code Mode deep dive](https://blog.cloudflare.com/code-mode-for-mcp/): optimized native tools for high-frequency operations, plus two universal tools for everything else.

| | Other Mailchimp MCPs | mailchimp-mcp |
|---|---|---|
| **Tools** | 40–50+ | **12** (10 native + search + execute) |
| **API coverage** | Partial | **Full (282 endpoints)** |
| **Token cost** | High (all schemas loaded) | **Minimal** |
| **Common tasks** | Same overhead as rare ones | **Optimized native tools** |
| **New endpoints** | Requires code changes | **Already covered via execute** |

## Quick Start

Add to your MCP client config (Claude Code, Claude Desktop, Cursor, etc.):

```json
{
  "mcpServers": {
    "mailchimp": {
      "command": "npx",
      "args": ["-y", "mailchimp-mcp"],
      "env": {
        "MAILCHIMP_API_KEY": "your-api-key-us12"
      }
    }
  }
}
```

The data center (`us12`, `us6`, etc.) is extracted automatically from your API key suffix.

### Get Your API Key

1. Log in to [Mailchimp](https://mailchimp.com)
2. Go to **Profile → Extras → API keys**
3. Click **Create A Key**
4. Copy the key (format: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-usXX`)

## Native Tools (The Fast Path)

These 10 tools cover the complete mass email workflow — no searching required:

| Tool | What it does |
|------|-------------|
| `list_audiences` | List all audiences with subscriber counts, open rates, click rates |
| `list_campaigns` | Browse campaigns by status (draft, sent, scheduled, etc.) |
| `create_campaign` | Create a new email campaign with subject, from name, reply-to |
| `update_campaign_content` | Set HTML content or assign a template to a campaign |
| `schedule_campaign` | Schedule a campaign for a future send time |
| `send_campaign` | Send a campaign immediately |
| `get_campaign_report` | Get opens, clicks, bounces, unsubscribes for a sent campaign |
| `list_templates` | Browse your email templates |
| `search_members` | Find subscribers by name or email across all audiences |
| `add_or_update_member` | Add/update a subscriber with auto MD5 hash + optional tags |

### Example: Full Campaign Workflow

```
1. list_audiences()                              → pick your audience
2. list_templates(type: "user")                  → pick a template
3. create_campaign(list_id, subject, from_name, reply_to)  → get campaign_id
4. update_campaign_content(campaign_id, template_id: 123)  → set the content
5. send_campaign(campaign_id)                    → send it
6. get_campaign_report(campaign_id)              → check performance
```

### Example: Add a Subscriber

```
add_or_update_member(
  list_id: "abc123",
  email: "jane@example.com",
  merge_fields: { "FNAME": "Jane", "LNAME": "Doe" },
  tags: ["VIP", "2026-spring"]
)
```

No need to compute the MD5 subscriber hash — it's handled automatically.

## Universal Tools (The Long Tail)

For anything beyond the 10 native tools, use `search` and `execute` to access all 282 Mailchimp API endpoints:

### Search: Discover endpoints

```
> search()
Mailchimp Marketing API — 282 endpoints across 29 categories
  lists (66), campaigns (22), reports (22), automations (18), ecommerce (60), ...

> search(tag: "automations")
> search(query: "segment members")
> search(query: "merge fields", method: "POST")
```

### Execute: Call any endpoint

```
> execute(method: "GET", path: "/ping")
{ "health_status": "Everything's Chimpy!" }

> execute(method: "GET", path: "/automations", params: { "count": "5" })

> execute(method: "POST", path: "/lists/{list_id}/segments", body: {
    "name": "Active subscribers",
    "static_segment": ["email1@test.com", "email2@test.com"]
  })
```

## API Categories

| Category | Endpoints | Description |
|----------|-----------|-------------|
| lists | 66 | Audiences, members, segments, merge fields, tags |
| ecommerce | 60 | Stores, products, orders, carts, customers |
| campaigns | 22 | Create, schedule, send, content, feedback |
| reports | 22 | Opens, clicks, bounces, email activity |
| automations | 18 | Workflows, triggered emails, queues |
| reporting | 12 | Advanced analytics |
| fileManager | 11 | File and image uploads |
| landingPages | 8 | Landing page management |
| templates | 6 | Email templates |
| + 20 more | | See `search()` for the full list |

## How It Works

**Hybrid architecture** — combines two patterns from the [Cloudflare Code Mode deep dive](https://blog.cloudflare.com/code-mode-for-mcp/):

1. **Native tools** — 10 purpose-built tools for the mass email workflow. Zero search overhead, optimized field selection, auto-computed subscriber hashes. These handle the Pareto 80% of operations.

2. **Search + Execute** — An embedded catalog of all 282 Mailchimp API endpoints (generated from the [official OpenAPI spec](https://github.com/mailchimp/mailchimp-client-lib-codegen/blob/main/spec/marketing.json)). Search discovers endpoints, execute calls them. This covers the long tail.

Total context footprint: ~12 tool schemas instead of 50+.

## Development

```bash
git clone https://github.com/livemau5/mailchimp-mcp.git
cd mailchimp-mcp
npm install
npm run build

# Regenerate the API catalog from the latest Mailchimp spec
npm run generate-catalog

# Run in development mode
MAILCHIMP_API_KEY=your-key-us12 npm run dev
```

## License

MIT
