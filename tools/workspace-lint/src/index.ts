/**
 * Workspace lint utility for the Voya monorepo.
 *
 * Validates:
 * 1. Catalogued dependencies are referenced via "catalog:" prefix, not literal versions
 * 2. Internal workspace packages are referenced via "workspace:" protocol
 * 3. engines.node and engines.pnpm are consistent with the root package.json
 *
 * Exit codes:
 *   0 — all checks pass
 *   1 — one or more violations found
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface Violation {
  file: string;
  field: string;
  expected: string;
  actual: string;
  rule: "catalog-drift" | "workspace-protocol" | "engines-mismatch";
}

export interface LintResult {
  violations: Violation[];
  checkedFiles: number;
}

/** Load catalog keys from pnpm-workspace.yaml (simple line parser, no YAML dep). */
export function loadCatalogKeys(workspaceYaml: string): Set<string> {
  const keys = new Set<string>();
  let inCatalog = false;

  for (const line of workspaceYaml.split("\n")) {
    if (line.trim() === "catalog:") {
      inCatalog = true;
      continue;
    }
    if (inCatalog) {
      // Blank line or non-indented line ends catalog section
      if (line.trim() === "" || (line.length > 0 && line[0] !== " ")) {
        inCatalog = false;
        continue;
      }
      const match = line.match(/^\s{2}["']?([^"':]+)["']?:/);
      if (match) keys.add(match[1]!.trim());
    }
  }
  return keys;
}

/** Collect all workspace package names from workspace packages. */
export function collectWorkspacePackageNames(
  manifests: { name: string; path: string }[],
): Set<string> {
  return new Set(manifests.map((m) => m.name));
}

function findPackageJsonFiles(root: string): string[] {
  const results: string[] = [];
  const skip = new Set(["node_modules", ".git", "dist", ".turbo"]);

  function walk(dir: string) {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (skip.has(entry)) continue;
      const full = join(dir, entry);
      try {
        const stat = statSync(full);
        if (stat.isDirectory()) {
          walk(full);
        } else if (entry === "package.json") {
          results.push(full);
        }
      } catch {
        // skip unreadable
      }
    }
  }

  walk(root);
  return results;
}

type PackageJson = {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  engines?: Record<string, string>;
  private?: boolean;
};

export function lintWorkspace(
  rootDir: string,
  catalogKeys: Set<string>,
  workspacePackageNames: Set<string>,
  rootEngines: Record<string, string>,
): LintResult {
  const pkgFiles = findPackageJsonFiles(rootDir).filter(
    (f) => !f.includes("/node_modules/"),
  );

  const violations: Violation[] = [];

  for (const pkgFile of pkgFiles) {
    let pkg: PackageJson;
    try {
      pkg = JSON.parse(readFileSync(pkgFile, "utf8")) as PackageJson;
    } catch {
      continue;
    }

    const allDeps = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
      ...(pkg.peerDependencies ?? {}),
    };

    for (const [depName, version] of Object.entries(allDeps)) {
      // 1. Catalog drift: if dep is in catalog, it must use "catalog:" reference
      if (
        catalogKeys.has(depName) &&
        version !== "catalog:" &&
        !version.startsWith("catalog:") &&
        !version.startsWith("workspace:")
      ) {
        violations.push({
          file: pkgFile,
          field: `dependencies.${depName}`,
          expected: "catalog:",
          actual: version,
          rule: "catalog-drift",
        });
      }

      // 2. Workspace protocol: internal packages must use workspace: prefix
      if (workspacePackageNames.has(depName) && !version.startsWith("workspace:")) {
        violations.push({
          file: pkgFile,
          field: `dependencies.${depName}`,
          expected: "workspace:*",
          actual: version,
          rule: "workspace-protocol",
        });
      }
    }

    // 3. Engines consistency
    if (pkg.engines) {
      for (const [engine, version] of Object.entries(pkg.engines)) {
        const rootVersion = rootEngines[engine];
        if (rootVersion && version !== rootVersion) {
          violations.push({
            file: pkgFile,
            field: `engines.${engine}`,
            expected: rootVersion,
            actual: version,
            rule: "engines-mismatch",
          });
        }
      }
    }
  }

  return { violations, checkedFiles: pkgFiles.length };
}

/** Human-readable report */
export function formatReport(result: LintResult): string {
  if (result.violations.length === 0) {
    return `✓ workspace-lint: ${result.checkedFiles} packages checked, 0 violations`;
  }

  const lines: string[] = [
    `✗ workspace-lint: ${result.violations.length} violation(s) across ${result.checkedFiles} packages\n`,
  ];

  for (const v of result.violations) {
    lines.push(`  ${v.file}`);
    lines.push(`    field:    ${v.field}`);
    lines.push(`    rule:     ${v.rule}`);
    lines.push(`    expected: ${v.expected}`);
    lines.push(`    actual:   ${v.actual}`);
    lines.push("");
  }

  return lines.join("\n");
}

// ─── CLI entry ────────────────────────────────────────────────────────────────

if (process.argv[1] && fileURLToPath(import.meta.url).endsWith(process.argv[1]?.split("/").pop() ?? "")) {
  const rootDir = resolve(process.cwd());
  const workspaceYamlPath = join(rootDir, "pnpm-workspace.yaml");
  const rootPkgPath = join(rootDir, "package.json");

  if (!existsSync(workspaceYamlPath)) {
    console.error("workspace-lint: pnpm-workspace.yaml not found at", workspaceYamlPath);
    process.exit(1);
  }

  const catalogKeys = loadCatalogKeys(readFileSync(workspaceYamlPath, "utf8"));
  const rootPkg = JSON.parse(readFileSync(rootPkgPath, "utf8")) as PackageJson;
  const rootEngines = rootPkg.engines ?? {};

  // Collect workspace package names
  const pkgFiles = findPackageJsonFiles(rootDir).filter(
    (f) => !f.includes("/node_modules/") && f !== rootPkgPath,
  );
  const manifests = pkgFiles
    .map((f) => {
      try {
        const p = JSON.parse(readFileSync(f, "utf8")) as PackageJson;
        return p.name ? { name: p.name, path: f } : null;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as { name: string; path: string }[];

  const workspacePackageNames = collectWorkspacePackageNames(manifests);
  const result = lintWorkspace(rootDir, catalogKeys, workspacePackageNames, rootEngines);
  console.log(formatReport(result));
  process.exit(result.violations.length > 0 ? 1 : 0);
}
