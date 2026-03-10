# mailchimp-mcp

**12 tools. 282 endpoints. Zero bloat.**

A hybrid Mailchimp MCP server built on the architecture Cloudflare pioneered for their own API: instead of drowning the model in 50+ tool definitions, we give it 10 fast native tools for the email workflow you actually use, plus two universal tools that unlock the entire Mailchimp Marketing API on demand.

---

## The Problem with Every Other Mailchimp MCP

There are half a dozen Mailchimp MCP servers on GitHub. They all do the same thing: expose 40–50+ individual tools, one per API operation. `list_campaigns`, `get_campaign`, `create_campaign`, `delete_campaign`, `list_audiences`, `get_audience`, `add_member`, `update_member`... on and on.

Every single one of those tool definitions gets loaded into the LLM's context window on every turn of every conversation — even when you're talking about something completely unrelated to Mailchimp. That's thousands of tokens burned before the model even starts thinking about your question.

This is the **context flooding** problem. Cloudflare ran the math on their own API (2,500+ endpoints) and found that exposing everything as native MCP tools would consume **1.17 million tokens** per turn. Even aggressively pruned, it was 244,000 tokens. Their solution was radical: collapse the entire API surface into just two tools — `search` and `execute` — and let the model discover what it needs on the fly. They called it [Code Mode](https://blog.cloudflare.com/code-mode-for-mcp/), and it reduced the footprint to ~1,000 tokens.

## Our Take: The Hybrid Architecture

Pure Code Mode is elegant, but it has a tradeoff. For the stuff you do every single day — list your audiences, create a campaign, check open rates — forcing the model to search the API catalog first adds an unnecessary round trip. You already know what you want. The model should too.

The [deeper analysis](https://blog.cloudflare.com/code-mode-for-mcp/) of real-world API traffic reveals a consistent pattern: a Pareto distribution. The vast majority of what people actually do hits a tiny subset of endpoints. The long tail is everything else.

So we built a hybrid:

**Layer 1: 10 native tools** for the mass email workflow. These are purpose-built, zero-overhead, and handle the 80% case. Creating a campaign, sending it, checking the report — one tool call, done. No searching, no discovering, no extra turns.

**Layer 2: `search` + `execute`** for everything else. An embedded catalog of all 282 Mailchimp API endpoints, generated from the [official OpenAPI spec](https://github.com/mailchimp/mailchimp-client-lib-codegen/blob/main/spec/marketing.json). The model searches to discover endpoints, then executes to call them. Automations, e-commerce, landing pages, file management, batch operations — it's all there without adding a single extra tool definition.

The result: **12 tool schemas** in your context window instead of 50+. Fast for the common case, omnipotent for the edge case.

| | Other Mailchimp MCPs | mailchimp-mcp |
|---|---|---|
| **Tools in context** | 40–50+ | **12** |
| **API coverage** | Partial | **Full (282 endpoints)** |
| **Token cost per turn** | High (all schemas always loaded) | **Minimal** |
| **Common tasks** | Same overhead as rare ones | **Optimized native tools** |
| **New Mailchimp endpoints** | Requires code changes | **Already covered via execute** |

---

## Setup

### Get Your Mailchimp API Key

1. Log in to [Mailchimp](https://mailchimp.com)
2. Go to **Profile → Extras → API keys**
3. Click **Create A Key**
4. Copy the key — it looks like: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-usXX`

The suffix after the dash (`us12`, `us6`, etc.) is your data center. The server extracts it automatically.

### Claude Code

Add to your `~/.claude.json` (or project-level `.claude.json`) under `mcpServers`:

```json
{
  "mcpServers": {
    "mailchimp": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "mailchimp-mcp"],
      "env": {
        "MAILCHIMP_API_KEY": "your-api-key-us12"
      }
    }
  }
}
```

Restart Claude Code for the server to connect. You'll see `mailchimp` in your MCP server list, and the tools will appear as `mcp__mailchimp__list_audiences`, `mcp__mailchimp__search`, etc.

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

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

Restart Claude Desktop. The Mailchimp tools will appear in the tools menu (hammer icon).

### Cursor / Windsurf / Other MCP Clients

The config pattern is the same — `npx -y mailchimp-mcp` as the command, with your API key in the `env` block. Consult your client's MCP documentation for where to place the config.

### Running from Source (Development)

If you cloned the repo instead of using npx:

```json
{
  "mcpServers": {
    "mailchimp": {
      "command": "node",
      "args": ["/path/to/mailchimp-mcp/dist/index.js"],
      "env": {
        "MAILCHIMP_API_KEY": "your-api-key-us12"
      }
    }
  }
}
```

---

## Native Tools: The Fast Path

These 10 tools cover the complete mass email lifecycle — no searching required:

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

### Example: End-to-End Campaign

```
1. list_audiences()                                          → find your audience ID
2. list_templates(type: "user")                              → find a template
3. create_campaign(list_id, subject, from_name, reply_to)    → get a campaign_id back
4. update_campaign_content(campaign_id, template_id: 123)    → set the email content
5. send_campaign(campaign_id)                                → fire it off
6. get_campaign_report(campaign_id)                          → check opens & clicks
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

The MD5 subscriber hash that Mailchimp requires is computed automatically from the email — you never have to think about it.

---

## Universal Tools: The Long Tail

For anything beyond the 10 native tools — automations, e-commerce, segments, webhooks, landing pages, file uploads, batch operations, and hundreds more — use `search` and `execute`.

### Search: Discover What's Available

Call with no arguments to see the full API map:

```
> search()

Mailchimp Marketing API — 282 endpoints across 29 categories

  lists (66) — Audiences, members, segments, merge fields, tags, webhooks, signups
  ecommerce (60) — Stores, products, orders, carts, customers
  campaigns (22) — Email campaigns — create, schedule, send, content, feedback
  reports (22) — Campaign performance reports — opens, clicks, bounces
  automations (18) — Marketing automation workflows and triggered emails
  ...
```

Narrow it down:

```
> search(tag: "automations")
> search(query: "segment members")
> search(query: "merge fields", method: "POST")
```

### Execute: Call Any Endpoint

```
> execute(method: "GET", path: "/ping")
{ "health_status": "Everything's Chimpy!" }

> execute(method: "GET", path: "/automations", params: { "count": "5" })

> execute(method: "POST", path: "/lists/{list_id}/segments", body: {
    "name": "Active subscribers",
    "static_segment": ["email1@test.com", "email2@test.com"]
  })
```

---

## All 29 API Categories

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
| verifiedDomains | 5 | Domain verification for sending |
| connectedSites | 5 | Connected e-commerce sites |
| batchWebhooks | 5 | Batch webhook configurations |
| campaignFolders | 5 | Organize campaigns into folders |
| templateFolders | 5 | Organize templates into folders |
| batches | 4 | Batch operations for bulk API calls |
| conversations | 4 | Conversation tracking and messages |
| contacts | 4 | Contact management |
| audiences | 4 | Audience management |
| Surveys | 3 | Survey management |
| accountExports | 2 | Account data exports |
| authorizedApps | 2 | OAuth authorized applications |
| facebookAds | 2 | Facebook ad campaigns |
| accountExport | 1 | Export account data |
| activityFeed | 1 | Activity feed events |
| customerJourneys | 1 | Customer journey automations |
| ping | 1 | API health check |
| root | 1 | API root and account info |
| searchCampaigns | 1 | Search campaigns by query |
| searchMembers | 1 | Search audience members by query |

---

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

### Project Structure

```
src/
  index.ts              Entry point — server setup, tool registration, stdio transport
  types.ts              CatalogEntry interface
  utils.ts              Data center extraction, URL building, auth, response formatting
  api-catalog.ts        Auto-generated catalog of all 282 endpoints
  tools/
    native.ts           10 native tools for the mass email workflow
    search.ts           Search tool — text/tag/method filtering over the catalog
    execute.ts          Execute tool — HTTP client with automatic Basic Auth
scripts/
  generate-catalog.ts   Parses official Mailchimp OpenAPI spec into api-catalog.ts
```

## License

MIT
