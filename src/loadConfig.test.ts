import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * loadConfig resolves its config path from PI_CODING_AGENT_DIR at module
 * import time, so each case sets the env and imports the module fresh.
 */
const tempDirs: string[] = [];

async function loadConfigWith(configContents: string | null): Promise<typeof import("./config.js")> {
  const agentDir = mkdtempSync(join(tmpdir(), "pi-searxng-test-"));
  tempDirs.push(agentDir);
  const extDir = join(agentDir, "extensions", "pi-searxng");
  mkdirSync(extDir, { recursive: true });
  if (configContents !== null) {
    writeFileSync(join(extDir, "config.json"), configContents);
  }
  process.env.PI_CODING_AGENT_DIR = agentDir;
  vi.resetModules();
  const mod = await import("./config.js");
  return mod;
}

describe("loadConfig", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.SEARXNG_URL;
    delete process.env.SEARXNG_CA_CERT;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    for (const d of tempDirs) rmSync(d, { recursive: true, force: true });
    tempDirs.length = 0;
    vi.restoreAllMocks();
  });

  it("returns defaults when no config file exists", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { loadConfig } = await loadConfigWith(null);

    const cfg = loadConfig();

    expect(cfg.searxngUrl).toBe("http://localhost:8080");
    expect(cfg.timeoutMs).toBe(30000);
    expect(cfg.safesearch).toBe("off");
  });

  it("merges valid overrides from the config file", async () => {
    const { loadConfig } = await loadConfigWith(
      JSON.stringify({ searxngUrl: "https://search.example.com", maxResults: 5, caCertPath: "/tmp/ca.pem" })
    );

    const cfg = loadConfig();

    expect(cfg.searxngUrl).toBe("https://search.example.com");
    expect(cfg.maxResults).toBe(5);
    expect(cfg.caCertPath).toBe("/tmp/ca.pem");
  });

  it("falls back to defaults on malformed JSON", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { loadConfig } = await loadConfigWith("{ not valid json");

    const cfg = loadConfig();

    expect(cfg.searxngUrl).toBe("http://localhost:8080");
  });

  it("falls back to defaults when a numeric field is invalid", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { loadConfig } = await loadConfigWith(JSON.stringify({ timeoutMs: -1 }));

    const cfg = loadConfig();

    expect(cfg.timeoutMs).toBe(30000);
  });

  it("falls back to defaults when safesearch is invalid", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { loadConfig } = await loadConfigWith(JSON.stringify({ safesearch: "bogus" }));

    const cfg = loadConfig();

    expect(cfg.safesearch).toBe("off");
  });

  it("falls back to defaults when caCertPath is not a string", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { loadConfig } = await loadConfigWith(JSON.stringify({ caCertPath: 123 }));

    const cfg = loadConfig();

    expect(cfg.caCertPath).toBeUndefined();
  });
});
