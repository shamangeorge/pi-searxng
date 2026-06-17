import { existsSync, readFileSync } from "node:fs";
import { request as httpsRequest } from "node:https";
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

interface RawResponse {
  status: number;
  ok: boolean;
  contentType: string;
  body: string;
}

/**
 * Fetch a URL using node:https so a custom CA certificate can be supplied
 * (Node's global fetch/undici does not honor a per-request CA without undici).
 */
function fetchWithCa(
  urlStr: string,
  caCertPath: string,
  timeoutMs: number
): Promise<RawResponse> {
  if (!existsSync(caCertPath)) {
    return Promise.reject(new Error(`CA certificate not found at ${caCertPath}`));
  }
  const ca = readFileSync(caCertPath);

  return new Promise<RawResponse>((resolve, reject) => {
    const req = httpsRequest(
      urlStr,
      {
        method: "GET",
        ca,
        headers: {
          Accept: "application/json",
          "User-Agent": "pi-searxng/1.0"
        }
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c as Buffer));
        res.on("end", () => {
          const status = res.statusCode || 0;
          resolve({
            status,
            ok: status >= 200 && status < 300,
            contentType: res.headers["content-type"] || "",
            body: Buffer.concat(chunks).toString("utf-8")
          });
        });
      }
    );
    req.setTimeout(timeoutMs, () => req.destroy(new Error("Request timed out")));
    req.on("error", reject);
    req.end();
  });
}

async function fetchRaw(urlStr: string, config: Config): Promise<RawResponse> {
  if (config.caCertPath) {
    return fetchWithCa(urlStr, config.caCertPath, config.timeoutMs);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const res = await fetch(urlStr, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "pi-searxng/1.0"
      }
    });
    return {
      status: res.status,
      ok: res.ok,
      contentType: res.headers.get("content-type") || "",
      body: await res.text()
    };
  } finally {
    clearTimeout(timeout);
  }
}

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

  {
    const res = await fetchRaw(url.toString(), config);

    if (!res.ok) {
      const body = res.body.slice(0, MAX_ERROR_BODY_LENGTH);
      throw new Error(`SearXNG returned ${res.status} at ${url.toString()}: ${body}`);
    }

    const responseText = res.body;

    const contentType = res.contentType;
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
  }
}
