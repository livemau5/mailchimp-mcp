# mailchimp-mcp

**2 tools. 282 endpoints. Zero bloat.**

A Mailchimp MCP server that covers the entire Marketing API through just two tools: `search` to discover endpoints, and `execute` to call them. No tool sprawl, no wasted tokens.

## Why?

Every other Mailchimp MCP server exposes 40–50+ individual tools. Each tool definition consumes tokens in the LLM context window on every single turn — even when you're not using Mailchimp. This server takes the approach pioneered by [Cloudflare's MCP](https://developers.cloudflare.com/agents/guides/remote-mcp-server/): just two generic tools that cover everything.

| | Other Mailchimp MCPs | mailchimp-mcp |
|---|---|---|
| **Tools** | 40–50+ | **2** |
| **API coverage** | Partial | **Full (282 endpoints)** |
| **Token cost** | High (all schemas loaded) | **Minimal** |
| **New endpoints** | Requires code changes | **Already covered** |

## Quick Start

### Install

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

## Usage

### Search: Discover endpoints

Call `search` with no arguments to see all 29 API categories:

```
> search()

Mailchimp Marketing API — 282 endpoints across 29 categories

  automations (18) — Marketing automation workflows and triggered emails
  campaigns (22) — Email campaigns — create, schedule, send, content, feedback
  lists (66) — Audiences — members, segments, merge fields, tags, webhooks, signups
  reports (22) — Campaign performance reports — opens, clicks, bounces
  templates (6) — Email templates — create, update, manage
  ...
```

Filter by category, HTTP method, or text search:

```
> search(tag: "campaigns", method: "POST")
> search(query: "members subscribed")
> search(query: "campaign send")
```

### Execute: Call any endpoint

```
> execute(method: "GET", path: "/ping")
{ "health_status": "Everything's Chimpy!" }

> execute(method: "GET", path: "/lists", params: { "count": "5" })
{ "lists": [...] }

> execute(method: "POST", path: "/lists/{list_id}/members", body: {
    "email_address": "user@example.com",
    "status": "subscribed",
    "merge_fields": { "FNAME": "Jane", "LNAME": "Doe" }
  })
```

## Example Workflows

### List your audiences and their subscriber counts
```
1. search(tag: "lists", method: "GET")
2. execute(method: "GET", path: "/lists", params: { "fields": "lists.id,lists.name,lists.stats.member_count" })
```

### Send a campaign
```
1. search(query: "campaign send")
2. execute(method: "GET", path: "/campaigns", params: { "count": "5", "status": "save" })
3. execute(method: "POST", path: "/campaigns/{campaign_id}/actions/send")
```

### Add a subscriber
```
1. search(query: "add member")
2. execute(method: "POST", path: "/lists/{list_id}/members", body: {
     "email_address": "subscriber@example.com",
     "status": "subscribed"
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

1. **Embedded catalog** — At build time, we parse Mailchimp's [official OpenAPI spec](https://github.com/mailchimp/mailchimp-client-lib-codegen/blob/main/spec/marketing.json) and generate a compact catalog of all 282 endpoints with their paths, methods, parameters, and descriptions.

2. **Search tool** — Filters and scores the catalog using text matching, tag filtering, and method filtering. Returns formatted results the LLM can use to construct API calls.

3. **Execute tool** — Makes HTTP requests to the Mailchimp API using native `fetch()`. Auth is handled automatically via HTTP Basic Auth with your API key.

## Development

```bash
git clone https://github.com/yourusername/mailchimp-mcp.git
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
