import type { Config } from "./config.js";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchResponse {
  results: SearchResult[];
}

const MAX_ERROR_BODY_LENGTH = 200;

export async function search(query: string, limit: number | undefined, config: Config): Promise<SearchResponse> {
  const url = new URL(`${config.searxngUrl}/search`);

  const safesearchMap: Record<string, "0" | "1" | "2"> = {
    off: "0",
    moderate: "1",
    strict: "2"
  };

  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("safesearch", safesearchMap[config.safesearch]);
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
        "User-Agent": "pi-searxng/1.0"
      }
    });
    
    if (!res.ok) {
      const body = (await res.text()).slice(0, MAX_ERROR_BODY_LENGTH);
      throw new Error(`SearXNG returned ${res.status} at ${url.toString()}: ${body}`);
    }

    // Read the body once as text to avoid "Body is unusable" errors when
    // trying to read it a second time after a failed res.json() call.
    const responseText = await res.text();

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error(
        `SearXNG returned non-JSON response (Content-Type: "${contentType}") at ${url.toString()}. ` +
        `First ${MAX_ERROR_BODY_LENGTH} chars: ${responseText.slice(0, MAX_ERROR_BODY_LENGTH)}`
      );
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error(
        `Failed to parse SearXNG response as JSON at ${url.toString()}. ` +
        `Response may be an error page. First ${MAX_ERROR_BODY_LENGTH} chars: ${responseText.slice(0, MAX_ERROR_BODY_LENGTH)}`
      );
    }
    
    const results: SearchResult[] = (data.results || [])
      .slice(0, limit || config.maxResults)
      .map((r: any) => ({
        title: r.title || "Untitled",
        url:
          typeof r.url === "string" && r.url ? r.url
          : typeof r.url_normalized === "string" && r.url_normalized ? r.url_normalized
          : "",
        snippet: r.content || r.abstract || ""
      }));
    
    return { results };
  } finally {
    clearTimeout(timeout);
  }
}
