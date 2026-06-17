import { afterEach, describe, expect, it, vi } from "vitest";
import { search } from "./searxng.js";
import type { Config } from "./config.js";

const baseConfig: Config = {
  searxngUrl: "https://search.example.com",
  caCertPath: undefined,
  timeoutMs: 5000,
  maxResults: 10,
  cacheFreshnessMs: 1000,
  cacheTtlMs: 1000,
  cacheMaxSize: 10,
  safesearch: "off"
};

/** Build a minimal fetch Response stub for the fetch (non-CA) branch. */
function fakeResponse(
  body: string,
  { status = 200, contentType = "application/json" } = {}
): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (k: string) => (k.toLowerCase() === "content-type" ? contentType : null) },
    text: async () => body
  } as unknown as Response;
}

function mockFetch(response: Response) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(response);
}

describe("search", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps SearXNG results to title/url/snippet", async () => {
    mockFetch(
      fakeResponse(
        JSON.stringify({
          results: [{ title: "Hello", url: "https://example.com", content: "world" }]
        })
      )
    );

    const { results } = await search("q", undefined, baseConfig);

    expect(results).toEqual([
      { title: "Hello", url: "https://example.com", snippet: "world" }
    ]);
  });

  it("applies fallbacks for missing fields", async () => {
    mockFetch(
      fakeResponse(
        JSON.stringify({
          results: [{ url_normalized: "https://fallback.example.com", abstract: "abs" }]
        })
      )
    );

    const { results } = await search("q", undefined, baseConfig);

    expect(results[0]).toEqual({
      title: "Untitled",
      url: "https://fallback.example.com",
      snippet: "abs"
    });
  });

  it("limits results to the requested limit", async () => {
    const results = Array.from({ length: 5 }, (_, i) => ({
      title: `t${i}`,
      url: `https://e${i}.example.com`,
      content: `c${i}`
    }));
    mockFetch(fakeResponse(JSON.stringify({ results })));

    const { results: out } = await search("q", 2, baseConfig);

    expect(out).toHaveLength(2);
  });

  it("falls back to maxResults when no limit is given", async () => {
    const results = Array.from({ length: 5 }, (_, i) => ({
      title: `t${i}`,
      url: `https://e${i}.example.com`
    }));
    mockFetch(fakeResponse(JSON.stringify({ results })));

    const { results: out } = await search("q", undefined, { ...baseConfig, maxResults: 3 });

    expect(out).toHaveLength(3);
  });

  it("sends the correct query, format and safesearch params", async () => {
    const spy = mockFetch(fakeResponse(JSON.stringify({ results: [] })));

    await search("cats", undefined, { ...baseConfig, safesearch: "strict" });

    const calledUrl = new URL(spy.mock.calls[0][0] as string);
    expect(calledUrl.pathname).toBe("/search");
    expect(calledUrl.searchParams.get("q")).toBe("cats");
    expect(calledUrl.searchParams.get("format")).toBe("json");
    expect(calledUrl.searchParams.get("safesearch")).toBe("2");
  });

  it("throws on a non-2xx response", async () => {
    mockFetch(fakeResponse("forbidden", { status: 403, contentType: "text/html" }));

    await expect(search("q", undefined, baseConfig)).rejects.toThrow(/403/);
  });

  it("throws on a non-JSON content type", async () => {
    mockFetch(fakeResponse("<html>nope</html>", { contentType: "text/html" }));

    await expect(search("q", undefined, baseConfig)).rejects.toThrow(/non-JSON/);
  });

  it("throws when the body is not valid JSON", async () => {
    mockFetch(fakeResponse("not json", { contentType: "application/json" }));

    await expect(search("q", undefined, baseConfig)).rejects.toThrow(/parse/i);
  });
});
