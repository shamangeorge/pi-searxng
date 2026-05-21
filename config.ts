import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CONFIG_PATH = join(homedir(), ".pi", "searxng.json");

export interface Config {
  searxngUrl: string;
  timeoutMs: number;
  maxResults: number;
  cacheFreshnessMs: number;
}

export function loadConfig(): Config {
  const defaults: Config = {
    searxngUrl: process.env.SEARXNG_URL || "http://localhost:8080",
    timeoutMs: 30000,
    maxResults: 10,
    cacheFreshnessMs: 15 * 60 * 1000 // 15 minutes
  };

  if (!existsSync(CONFIG_PATH)) {
    return defaults;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `Failed to parse config file (${CONFIG_PATH}): ${msg}\n` +
      `SearXNG will use default settings. Fix the config file or delete it to restore defaults.`
    );
    return defaults;
  }

  const config = { ...defaults, ...raw } as Config;

  try {
    if (typeof config.searxngUrl !== "string") {
      throw new Error("'searxngUrl' must be a string");
    }
    if (typeof config.timeoutMs !== "number" || config.timeoutMs <= 0) {
      throw new Error("'timeoutMs' must be a positive number");
    }
    if (typeof config.maxResults !== "number" || config.maxResults <= 0) {
      throw new Error("'maxResults' must be a positive number");
    }
    if (typeof config.cacheFreshnessMs !== "number" || config.cacheFreshnessMs <= 0) {
      throw new Error("'cacheFreshnessMs' must be a positive number");
    }

    return config;
  } catch (err) {
    console.warn(
      `Invalid config values, using defaults: ${err instanceof Error ? err.message : String(err)}`
    );
    return defaults;
  }
}
