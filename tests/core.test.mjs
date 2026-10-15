import test from "node:test";
import assert from "node:assert/strict";
import {
  mentionAt,
  normalizeSkills,
  filterSkills,
  insertSkill,
} from "../client/core.mjs";
import plugin, { completionCatalog } from "../index.mjs";

test("dollar triggers and boundaries", () => {
  assert.deepEqual(mentionAt("$", 1), { start: 0, end: 1, query: "" });
  assert.deepEqual(mentionAt("检查 $co", 6), { start: 3, end: 6, query: "co" });
  for (const s of ["mail$x", "\\$co", "$$co", "`$co", "$co "])
    assert.equal(mentionAt(s, s.length), null);
  assert.equal(mentionAt("$co", 0, 3), null);
  assert.equal(mentionAt("前文\n$co", 6).query, "co");
});
test("cursor in token replaces its full range, preserving prose", () => {
  const text = "检查 $co-old 后文";
  const token = mentionAt(text, 6);
  assert.equal(token.end, 10);
  assert.deepEqual(insertSkill(text, token, "code-review"), {
    text: "检查 $code-review 后文",
    caret: 15,
  });
});
test("multiple mentions and safe names", () => {
  const text = "$code-review $fr";
  assert.equal(
    insertSkill(text, mentionAt(text, text.length), "frontend-design").text,
    "$code-review $frontend-design ",
  );
  const skills = normalizeSkills([
    { name: "code-review" },
    { name: "commit" },
    { name: "code-review" },
    { name: "bad name" },
    { name: "<script>" },
  ]);
  assert.equal(skills.length, 2);
  assert.equal(filterSkills(skills, "CODE")[0].name, "code-review");
});
test("filter ranks exact, prefix, then substring matches", () => {
  const skills = normalizeSkills([
    { name: "jira" },
    { name: "jira-flow" },
    { name: "code-review" },
    { name: "codebase-audit" },
    { name: "commit" },
    { name: "deploy" },
  ]);
  // Empty query keeps the full alphabetical catalog.
  assert.deepEqual(
    filterSkills(skills, "").map((s) => s.name),
    ["code-review", "codebase-audit", "commit", "deploy", "jira", "jira-flow"],
  );
  // Case-insensitive; exact match ranks above prefix and substring.
  assert.deepEqual(
    filterSkills(skills, "JIRA").map((s) => s.name),
    ["jira", "jira-flow"],
  );
  // Names containing the query are included after prefix matches.
  assert.deepEqual(
    filterSkills(skills, "ode").map((s) => s.name),
    ["code-review", "codebase-audit"],
  );
  // Substring-only queries still match.
  assert.deepEqual(
    filterSkills(skills, "review").map((s) => s.name),
    ["code-review"],
  );
  assert.deepEqual(filterSkills(skills, "zzz"), []);
});
test("manual catalog, exclusion, configuration errors", async () => {
  const host = {
    getSettings: () => ({
      catalog: '[{"name":"a"},{"name":"b"}]',
      excludedSkills: '["a"]',
    }),
  };
  assert.deepEqual(
    await completionCatalog(host, () => {
      throw Error("must not load SDK");
    }),
    [{ name: "b", description: "" }],
  );
  await assert.rejects(
    completionCatalog({ getSettings: () => ({ catalog: "{}" }) }),
    /JSON 数组/,
  );
});
test("metadata-only SDK call uses current cwd and extra paths", async () => {
  let options;
  const host = {
    cwd: "/project",
    getSettings: () => ({ skillPaths: '["/extra"]' }),
  };
  assert.equal(
    (
      await completionCatalog(host, async () => (opts) => {
        options = opts;
        return {
          skills: [{ name: "real", description: "d", filePath: "/secret" }],
        };
      })
    )[0].name,
    "real",
  );
  assert.equal(options.cwd, "/project");
  assert.deepEqual(options.skillPaths, ["/extra"]);
  assert.equal(options.includeDefaults, true);
});
test("actual route contract, errors do not leak content", async () => {
  const routes = new Map();
  plugin.activate({
    getSettings: () => ({ catalog: '[{"name":"review","content":"private"}]' }),
    route: (method, path, fn) => {
      routes.set(`${method} ${path}`, fn);
      return () => {};
    },
  });
  let response;
  await routes.get("GET /skills")(
    {},
    {
      setHeader() {},
      json(v) {
        response = v;
      },
      status() {
        return this;
      },
    },
  );
  assert.deepEqual(response, {
    ok: true,
    skills: [{ name: "review", description: "" }],
  });
  assert.equal(routes.size, 2);
});
