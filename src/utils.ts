const MAX_RESPONSE_BYTES = 50_000;

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
