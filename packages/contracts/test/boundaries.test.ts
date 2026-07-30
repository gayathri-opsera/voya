import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Dependency boundary test: asserts that @travel/contracts has ONLY zod as a
 * runtime dependency. Pulling in Express, Prisma, Stripe, Anthropic, or any
 * AWS SDK would pollute the browser bundle and violate the platform policy.
 */
describe("@travel/contracts dependency boundaries", () => {
  const packageJson = JSON.parse(
    readFileSync(resolve(__dirname, "../package.json"), "utf-8"),
  ) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  const runtimeDeps = Object.keys(packageJson.dependencies ?? {});
  const devDeps = Object.keys(packageJson.devDependencies ?? {});
  const allDeps = [...runtimeDeps, ...devDeps];

  it("has only zod as a runtime dependency", () => {
    expect(runtimeDeps).toEqual(["zod"]);
  });

  it("does not depend on express", () => {
    const expressPresent = allDeps.some((d) => d === "express" || d.startsWith("@types/express"));
    expect(expressPresent).toBe(false);
  });

  it("does not depend on @prisma/client", () => {
    const prismaPresent = allDeps.some((d) => d === "@prisma/client" || d === "prisma");
    expect(prismaPresent).toBe(false);
  });

  it("does not depend on stripe", () => {
    const stripePresent = allDeps.some((d) => d === "stripe");
    expect(stripePresent).toBe(false);
  });

  it("does not depend on @anthropic-ai/sdk", () => {
    const anthropicPresent = allDeps.some((d) => d.startsWith("@anthropic-ai"));
    expect(anthropicPresent).toBe(false);
  });

  it("does not depend on any AWS SDK", () => {
    const awsPresent = allDeps.some(
      (d) => d.startsWith("@aws-sdk") || d.startsWith("aws-sdk"),
    );
    expect(awsPresent).toBe(false);
  });
});
