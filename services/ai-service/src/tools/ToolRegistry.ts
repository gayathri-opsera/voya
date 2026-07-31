/**
 * ToolRegistry — WO-056: First-party tool registry with allow-listed search tools.
 *
 * Only tools in the registry can be invoked by the AI assistant.
 * Each tool must declare:
 * - A unique name
 * - Input/output schema
 * - An executor function
 * - Risk classification (LOW/MEDIUM/HIGH) — HIGH requires human-in-the-loop
 */

export type ToolRisk = "LOW" | "MEDIUM" | "HIGH";

export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  risk: ToolRisk;
  inputSchema: Record<string, unknown>;
  execute(input: TInput): Promise<TOutput>;
}

export class ToolNotFoundError extends Error {
  constructor(name: string) {
    super(`Tool not found in registry: ${name}`);
    this.name = "ToolNotFoundError";
  }
}

export class ToolNotAllowedError extends Error {
  constructor(name: string) {
    super(`Tool is not allow-listed: ${name}`);
    this.name = "ToolNotAllowedError";
  }
}

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolDefinition {
    const tool = this.tools.get(name);
    if (!tool) throw new ToolNotFoundError(name);
    return tool;
  }

  list(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  async execute(name: string, input: unknown): Promise<unknown> {
    const tool = this.get(name);
    if (tool.risk === "HIGH") {
      throw new ToolNotAllowedError(`${name} requires human approval`);
    }
    return tool.execute(input);
  }
}

/** Factory: builds the default registry with search tools. */
export function buildDefaultToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  registry.register({
    name: "search_flights",
    description: "Search for available flights between two airports",
    risk: "LOW",
    inputSchema: {
      type: "object",
      properties: {
        origin: { type: "string" },
        destination: { type: "string" },
        date: { type: "string", format: "date" },
        passengers: { type: "integer", minimum: 1 },
      },
      required: ["origin", "destination", "date", "passengers"],
    },
    async execute(input) { return { results: [], input }; },
  });

  registry.register({
    name: "search_hotels",
    description: "Search for hotels at a destination",
    risk: "LOW",
    inputSchema: {
      type: "object",
      properties: {
        destination: { type: "string" },
        checkin: { type: "string", format: "date" },
        checkout: { type: "string", format: "date" },
        guests: { type: "integer", minimum: 1 },
      },
      required: ["destination", "checkin", "checkout", "guests"],
    },
    async execute(input) { return { results: [], input }; },
  });

  registry.register({
    name: "search_cars",
    description: "Search for car rentals at a pickup location",
    risk: "LOW",
    inputSchema: {
      type: "object",
      properties: {
        pickup_location: { type: "string" },
        pickup_date: { type: "string", format: "date" },
        return_date: { type: "string", format: "date" },
      },
      required: ["pickup_location", "pickup_date", "return_date"],
    },
    async execute(input) { return { results: [], input }; },
  });

  registry.register({
    name: "get_offer_details",
    description: "Retrieve full details for a specific offer",
    risk: "LOW",
    inputSchema: {
      type: "object",
      properties: { offer_id: { type: "string" } },
      required: ["offer_id"],
    },
    async execute(input) { return { offer: null, input }; },
  });

  return registry;
}
