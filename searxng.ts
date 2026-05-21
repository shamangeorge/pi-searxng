import { loadConfig } from "./config.js";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchResponse {
  results: SearchResult[];
}

const MAX_ERROR_BODY_LENGTH = 200;

export async function search(query: string, limit?: number): Promise<SearchResponse> {
  const config = loadConfig();
  const url = new URL(`${config.searxngUrl}/search`);
  
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("safesearch", "0");
  
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
      const body = await res.text().slice(0, MAX_ERROR_BODY_LENGTH);
      throw new Error(`SearXNG returned ${res.status} at ${url.toString()}: ${body}`);
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      const body = await res.text().slice(0, MAX_ERROR_BODY_LENGTH);
      throw new Error(
        `SearXNG returned non-JSON response (Content-Type: "${contentType}") at ${url.toString()}. ` +
        `First ${MAX_ERROR_BODY_LENGTH} chars: ${body}`
      );
    }

    let data;
    try {
      data = await res.json();
    } catch {
      const body = await res.text().slice(0, MAX_ERROR_BODY_LENGTH);
      throw new Error(
        `Failed to parse SearXNG response as JSON at ${url.toString()}. ` +
        `Response may be an error page. First ${MAX_ERROR_BODY_LENGTH} chars: ${body}`
      );
    }
    
    const results: SearchResult[] = (data.results || [])
      .slice(0, limit || config.maxResults)
      .map((r: any) => ({
        title: r.title || "Untitled",
        url: r.url,
        snippet: r.content || r.abstract || ""
      }));
    
    return { results };
  } finally {
    clearTimeout(timeout);
  }
}
