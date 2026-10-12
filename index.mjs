// Read-only completion metadata adapter. No prompts, tools, or skill expansion.
import { resolve, join } from "node:path";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { homedir } from "node:os";
import { normalizeSkills } from "./client/core.mjs";

function arraySetting(settings, key) {
  const value = JSON.parse(settings[key] || "[]");
  if (!Array.isArray(value)) throw new Error(`${key} 必须是 JSON 数组`);
  return value;
}

export async function resolveSkillLoader() {
  // The official host's resolve-global-sdk hook resolves this ESM import to its
  // existing SDK. Do not install or construct another agent runtime.
  try {
    const sdk = await import("@earendil-works/pi-coding-agent");
    if (typeof sdk.loadSkills === "function") return sdk.loadSkills;
    throw new Error("SDK 没有公开 loadSkills");
  } catch (error) {
    // Bundled mode installs no redirect hook. Plugins live outside the app's
    // node_modules tree: resolve the package's declared ESM export from the
    // running host entrypoint, rather than guessing its dist layout.
    if (process.argv[1]) {
      const require = createRequire(pathToFileURL(resolve(process.argv[1])));
      for (const root of require.resolve
        .paths("@earendil-works/pi-coding-agent") || []) {
        try {
          const dir = join(root, "@earendil-works/pi-coding-agent");
          const pkg = JSON.parse(
            await readFile(join(dir, "package.json"), "utf8"),
          );
          const entry = pkg.exports?.["."]?.import || pkg.main;
          if (typeof entry !== "string") continue;
          const sdk = await import(pathToFileURL(resolve(dir, entry)).href);
          if (typeof sdk.loadSkills === "function") return sdk.loadSkills;
        } catch {
          /* Continue through the host's package resolution paths. */
        }
      }
    }
    throw new Error(
      `无法读取宿主 Pi SDK；可填写手动技能目录 catalog。原因：${error.message}`,
    );
  }
}

export async function completionCatalog(host, getLoader = resolveSkillLoader) {
  const settings = host.getSettings();
  const manual = arraySetting(settings, "catalog");
  const excluded = new Set(arraySetting(settings, "excludedSkills"));
  let skills = manual;
  if (!manual.length) {
    const loadSkills = await getLoader();
    const paths = arraySetting(settings, "skillPaths");
    if (paths.some((p) => typeof p !== "string"))
      throw new Error("skillPaths 中的路径必须是字符串");
    skills = loadSkills({
      cwd: settings.projectCwd || host.cwd,
      agentDir:
        process.env.PI_CODING_AGENT_DIR || resolve(homedir(), ".pi/agent"),
      skillPaths: paths,
      includeDefaults: true,
    }).skills;
  }
  return normalizeSkills(skills).filter((s) => !excluded.has(s.name));
}

export default {
  activate(host) {
    host.route("GET", "/status", (_req, res) => res.json({ ok: true }));
    // Each request re-reads current settings/cwd. The client requests on each new token.
    return host.route("GET", "/skills", async (_req, res) => {
      res.setHeader("Cache-Control", "no-store");
      try {
        res.json({ ok: true, skills: await completionCatalog(host) });
      } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
      }
    });
  },
};
