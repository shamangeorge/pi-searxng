import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import { search } from "./searxng.js";
import { fetchContent } from "./extract.js";


const searchCache = new Map<string, { query: string; results: any[] }>();

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
      
      try {
        const { results } = await search(params.query, params.limit);
        const searchId = generateId();
        searchCache.set(searchId, { query: params.query, results });
        
        return {
          content: [{ type: "text", text: formatSearchResults(results) }],
          details: { searchId, resultCount: results.length, query: params.query }
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          details: { error: String(err) }
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
    name: "fetch_content",
    label: "Fetch Content",
    description: "Fetch and extract readable content from a URL.",
    parameters: Type.Object({
      url: Type.String({ description: "URL to fetch" })
    }),
    
    async execute(_id, params, signal) {
      if (signal?.aborted) {
        return { content: [{ type: "text", text: "Aborted" }] };
      }

      const result = await fetchContent(params.url);
      
      if (result.error) {
        return {
          content: [{ type: "text", text: `Error: ${result.error}` }],
          details: { error: result.error }
        };
      }
      
      const truncated = result.content.length > 30000;
      const content = truncated 
        ? result.content.slice(0, 30000) + "\n\n[Content truncated...]"
        : result.content;
      
      return {
        content: [{ type: "text", text: content }],
        details: { 
          title: result.title, 
          url: result.url, 
          truncated,
          length: result.content.length 
        }
      };
    },
    
    renderCall(args, theme) {
      const url = (args as any).url || "";
      const display = url.length > 50 ? url.slice(0, 47) + "..." : url;
      return new Text(theme.fg("toolTitle", "fetch ") + theme.fg("accent", display), 0, 0);
    },
    
    renderResult(result, _opts, theme) {
      const details = result.details as any;
      const length = details?.length || 0;
      return new Text(theme.fg("success", `${length} chars`) + (details?.truncated ? theme.fg("warning", " [truncated]") : ""), 0, 0);
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
      const cached = searchCache.get(params.searchId);
      if (!cached) {
        return { content: [{ type: "text", text: "Search not found" }] };
      }
      return {
        content: [{ type: "text", text: `Query: "${cached.query}"\n\n${formatSearchResults(cached.results)}` }]
      };
    }
  });
}
