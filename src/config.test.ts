import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { homedir } from "node:os";
import { join } from "node:path";
import { resolveAgentDir } from "./config.js";

describe("resolveAgentDir", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.PI_CODING_AGENT_DIR;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns PI_CODING_AGENT_DIR verbatim without re-appending .pi/agent", () => {
    // Regression: PI_CODING_AGENT_DIR already ends in .pi/agent, so the
    // resolver must not append another .pi/agent segment.
    process.env.PI_CODING_AGENT_DIR = "/home/user/.pi/agent";

    const result = resolveAgentDir();

    expect(result).toBe("/home/user/.pi/agent");
    expect(result).not.toContain(join(".pi", "agent", ".pi", "agent"));
  });

  it("expands a leading ~ in PI_CODING_AGENT_DIR to the home directory", () => {
    process.env.PI_CODING_AGENT_DIR = "~/.pi/agent";

    const result = resolveAgentDir();

    expect(result).toBe(join(homedir(), ".pi", "agent"));
  });

  it("falls back to HOME/.pi/agent when PI_CODING_AGENT_DIR is unset", () => {
    process.env.HOME = "/home/testuser";

    const result = resolveAgentDir();

    expect(result).toBe(join("/home/testuser", ".pi", "agent"));
  });

  it("prefers PI_CODING_AGENT_DIR over HOME", () => {
    process.env.HOME = "/home/testuser";
    process.env.PI_CODING_AGENT_DIR = "/custom/agent/dir";

    const result = resolveAgentDir();

    expect(result).toBe("/custom/agent/dir");
  });
});
