import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Resolves the pi coding agent directory in a robust way.
 * Prioritizes PI_CODING_AGENT_DIR (if it points to an agent directory),
 * then HOME, and finally homedir() as a last resort.
 */
export function resolveAgentDir(): string {
  // PI_CODING_AGENT_DIR is the full agent directory
  const piDir = process.env.PI_CODING_AGENT_DIR;
  if (piDir) {
    // Expand ~ to actual home directory (handles both ~/ and ~\)
    if (piDir.startsWith("~/") || piDir.startsWith("~\\")) {
      return join(homedir(), piDir.slice(2));
    }
    return piDir;
  }
  // Fallback: HOME env var or homedir()
  const hd = homedir();
  if (process.env.HOME) {
    return join(process.env.HOME, ".pi", "agent");
  }
  if (hd) {
    return join(hd, ".pi", "agent");
  }
  return join("/", ".pi", "agent");
}

const CONFIG_PATH = join(
  resolveAgentDir(),
  "extensions",
  "pi-searxng",
  "config.json"
);

export interface Config {
  searxngUrl: string;
  caCertPath?: string;
  timeoutMs: number;
  maxResults: number;
  cacheFreshnessMs: number;
  cacheTtlMs: number;
  cacheMaxSize: number;
  safesearch: "off" | "moderate" | "strict";
}

/** Config fields that must be positive numbers. */
const POSITIVE_NUMBER_FIELDS = [
  "timeoutMs",
  "maxResults",
  "cacheFreshnessMs",
  "cacheTtlMs",
  "cacheMaxSize"
] as const;

const VALID_SAFESEARCH = ["off", "moderate", "strict"];

/**
 * Validate a merged config object, throwing on the first invalid field.
 * Kept separate from loadConfig to keep each function's complexity low.
 */
function validateConfig(config: Config): void {
  if (typeof config.searxngUrl !== "string") {
    throw new Error("'searxngUrl' must be a string");
  }
  if (config.caCertPath !== undefined && typeof config.caCertPath !== "string") {
    throw new Error("'caCertPath' must be a string");
  }
  for (const field of POSITIVE_NUMBER_FIELDS) {
    const value = config[field];
    if (typeof value !== "number" || value <= 0) {
      throw new Error(`'${field}' must be a positive number`);
    }
  }
  if (!VALID_SAFESEARCH.includes(config.safesearch)) {
    throw new Error("'safesearch' must be one of: 'off', 'moderate', 'strict'");
  }
}

/** Read and parse the config file, returning null if missing or invalid JSON. */
function readConfigFile(): Record<string, unknown> | null {
  if (!existsSync(CONFIG_PATH)) {
    console.info(`Config file not found at ${CONFIG_PATH}. Using default settings.`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `Failed to parse config file (${CONFIG_PATH}): ${msg}\n` +
      `SearXNG will use default settings. Fix the config file or delete it to restore defaults.`
    );
    return null;
  }
}

export function loadConfig(): Config {
  const defaults: Config = {
    searxngUrl: process.env.SEARXNG_URL || "http://localhost:8080",
    caCertPath: process.env.SEARXNG_CA_CERT || undefined,
    timeoutMs: 30000,
    maxResults: 10,
    cacheFreshnessMs: 15 * 60 * 1000, // 15 minutes
    cacheTtlMs: 24 * 60 * 60 * 1000,  // 24 hours
    cacheMaxSize: 200,
    safesearch: "off"
  };

  const raw = readConfigFile();
  if (raw === null) {
    return defaults;
  }

  const config = { ...defaults, ...raw } as Config;

  try {
    validateConfig(config);
    return config;
  } catch (err) {
    console.warn(
      `Invalid config values, using defaults: ${err instanceof Error ? err.message : String(err)}`
    );
    return defaults;
  }
}
