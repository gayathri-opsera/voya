import { describe, it, expect } from "vitest";
import {
  ToolRegistry,
  buildDefaultToolRegistry,
  ToolNotFoundError,
  ToolNotAllowedError,
} from "../../src/tools/ToolRegistry.ts";

describe("ToolRegistry", () => {
  it("registers and retrieves a tool", () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "my_tool",
      description: "Test tool",
      risk: "LOW",
      inputSchema: {},
      execute: async () => ({ ok: true }),
    });
    const tool = registry.get("my_tool");
    expect(tool.name).toBe("my_tool");
  });

  it("throws ToolNotFoundError for unknown tools", () => {
    const registry = new ToolRegistry();
    expect(() => registry.get("nonexistent")).toThrow(ToolNotFoundError);
  });

  it("executes a LOW-risk tool", async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "safe_tool",
      description: "Safe",
      risk: "LOW",
      inputSchema: {},
      execute: async (input) => ({ echoed: input }),
    });
    const result = await registry.execute("safe_tool", { foo: "bar" });
    expect(result).toEqual({ echoed: { foo: "bar" } });
  });

  it("throws ToolNotAllowedError for HIGH-risk tools", async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "dangerous_tool",
      description: "Dangerous",
      risk: "HIGH",
      inputSchema: {},
      execute: async () => ({}),
    });
    await expect(registry.execute("dangerous_tool", {})).rejects.toThrow(ToolNotAllowedError);
  });

  it("default registry has search tools", () => {
    const registry = buildDefaultToolRegistry();
    const tools = registry.list();
    expect(tools.map((t) => t.name)).toContain("search_flights");
    expect(tools.map((t) => t.name)).toContain("search_hotels");
    expect(tools.map((t) => t.name)).toContain("search_cars");
    expect(tools.map((t) => t.name)).toContain("get_offer_details");
  });
});
