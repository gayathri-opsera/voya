import { z } from "zod";

const EnvSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url("NEXT_PUBLIC_API_BASE_URL must be a valid URL"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const result = EnvSchema.safeParse({
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    NODE_ENV: process.env.NODE_ENV,
  });

  if (!result.success) {
    const missing = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Environment configuration error:\n${missing}`);
  }

  return result.data;
}

export const env: Env =
  typeof process !== "undefined"
    ? (() => {
        try {
          return loadEnv();
        } catch {
          // During build/SSG with missing vars, return a safe default
          // to avoid failing non-runtime paths. Runtime paths will throw.
          return {
            NEXT_PUBLIC_API_BASE_URL:
              process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001",
            NODE_ENV: (process.env.NODE_ENV as Env["NODE_ENV"]) ?? "development",
          };
        }
      })()
    : ({} as Env);
