const MAX_RESPONSE_BYTES = 50_000;
const COMPACT_RESPONSE_BYTES = 4_000;

export function extractDataCenter(apiKey: string): string {
  const parts = apiKey.split("-");
  const dc = parts[parts.length - 1];
  if (!dc || !/^[a-z]{2}\d+$/.test(dc)) {
    throw new Error(
      `Invalid API key format. Expected "key-dc" (e.g., "abc123-us12"), got suffix "${dc}"`
    );
  }
  return dc;
}

export function buildUrl(
  dc: string,
  path: string,
  params?: Record<string, string>
): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`https://${dc}.api.mailchimp.com/3.0${normalizedPath}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

export function buildAuthHeader(apiKey: string): string {
  return `Basic ${Buffer.from(`anystring:${apiKey}`).toString("base64")}`;
}

export function formatResponse(data: unknown): string {
  const json = JSON.stringify(data, null, 2);
  if (json.length > MAX_RESPONSE_BYTES) {
    const truncated = json.slice(0, MAX_RESPONSE_BYTES);
    return (
      truncated +
      `\n\n... [Response truncated at ${MAX_RESPONSE_BYTES} bytes. Use "count" and "offset" query params to paginate.]`
    );
  }
  return json;
}

/**
 * Summarize a write response into a compact confirmation.
 * Extracts key fields to avoid flooding the LLM context with full API responses.
 */
export function summarizeWriteResponse(
  data: unknown,
  action: string
): string {
  if (typeof data !== "object" || data === null) {
    return `${action}: Success`;
  }
  const d = data as Record<string, unknown>;

  const summary: Record<string, unknown> = {};
  const keepFields = [
    "id", "web_id", "type", "status", "title", "name",
    "email_address", "unique_email_id", "list_id",
    "send_time", "emails_sent", "content_type",
    "subject_line", "from_name", "reply_to",
    "member_count", "date_created",
  ];
  for (const key of keepFields) {
    if (key in d) summary[key] = d[key];
  }
  // Flatten settings if present
  if (typeof d.settings === "object" && d.settings !== null) {
    const s = d.settings as Record<string, unknown>;
    if (s.subject_line) summary.subject_line = s.subject_line;
    if (s.title) summary.title = s.title;
    if (s.from_name) summary.from_name = s.from_name;
  }

  if (Object.keys(summary).length > 0) {
    return `${action}\n${JSON.stringify(summary, null, 2)}`;
  }

  const json = JSON.stringify(data, null, 2);
  if (json.length > COMPACT_RESPONSE_BYTES) {
    return `${action}\n${json.slice(0, COMPACT_RESPONSE_BYTES)}\n\n... [Truncated. Use get_campaign_report or list_campaigns for full data.]`;
  }
  return `${action}\n${json}`;
}

export function formatError(status: number, body: unknown): string {
  if (typeof body === "object" && body !== null) {
    const err = body as Record<string, unknown>;
    let msg = `Error ${status}: ${err.title ?? "Unknown error"}`;
    if (err.detail) msg += `\n${err.detail}`;
    if (Array.isArray(err.errors)) {
      for (const e of err.errors) {
        msg += `\n  - ${e.field}: ${e.message}`;
      }
    }
    if (status === 401) msg += "\n\nHint: Check that your MAILCHIMP_API_KEY is valid.";
    if (status === 429) msg += "\n\nRate limited. Wait a moment and try again.";
    return msg;
  }
  return `Error ${status}: ${String(body)}`;
}
