import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "@sinclair/typebox";
import type { SearchResult } from "./searxng.js";
import { search } from "./searxng.js";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE_SIZE = 200;

const searchCache = new Map<string, {
  query: string;
  results: SearchResult[];
  timestamp: number;
}>();

function cleanup(): void {
  const now = Date.now();

  // Remove expired entries
  for (const [id, entry] of searchCache) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      searchCache.delete(id);
    }
  }

  // Evict oldest entries if over limit
  while (searchCache.size > MAX_CACHE_SIZE) {
    const firstKey = searchCache.keys().next().value;
    if (firstKey) searchCache.delete(firstKey);
  }
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function formatSearchResults(results: any[]): string {
  if (results.length === 0) return "No results found.";
  return results.map((r, i) => 
    `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.snippet.slice(0, 200)}${r.snippet.length > 200 ? "..." : ""}`
  ).join("\n\n");
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "web_search",
    label: "Web Search",
    description: "Search the web using SearXNG",
    parameters: Type.Object({
      query: Type.String({ description: "Search query" }),
      limit: Type.Optional(Type.Number({ description: "Max results", default: 10 }))
    }),
    
    async execute(_id, params, signal) {
      if (signal?.aborted) {
        return { content: [{ type: "text", text: "Aborted" }] };
      }
      
      const searchId = generateId();
      
      try {
        cleanup();
        const { results } = await search(params.query, params.limit);
        searchCache.set(searchId, { query: params.query, results, timestamp: Date.now() });
        
        return {
          content: [{ type: "text", text: formatSearchResults(results) }],
          details: { searchId, resultCount: results.length, query: params.query }
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          details: { searchId, error: String(err) }
        };
      }
    },
    
    renderCall(args, theme) {
      const q = (args as any).query || "";
      const display = q.length > 50 ? q.slice(0, 47) + "..." : q;
      return new Text(theme.fg("toolTitle", "search ") + theme.fg("accent", `"${display}"`), 0, 0);
    },
    
    renderResult(result, _opts, theme) {
      const count = (result.details as any)?.resultCount || 0;
      return new Text(theme.fg("success", `${count} results`), 0, 0);
    }
  });

  pi.registerTool({
    name: "get_search_results",
    label: "Get Search Results",
    description: "Retrieve previous search results by ID",
    parameters: Type.Object({
      searchId: Type.String()
    }),
    
    async execute(_id, params) {
      cleanup();

      const cached = searchCache.get(params.searchId);
      if (!cached) {
        return {
          content: [{ type: "text", text: "Search not found" }],
          details: { searchId: params.searchId, error: "Search not found" }
        };
      }

      // Refresh timestamp (LRU behavior)
      cached.timestamp = Date.now();

      return {
        content: [{ type: "text", text: `Query: "${cached.query}"\n\n${formatSearchResults(cached.results)}` }],
        details: { searchId: params.searchId, query: cached.query, resultCount: cached.results.length }
      };
    }
  });
}
