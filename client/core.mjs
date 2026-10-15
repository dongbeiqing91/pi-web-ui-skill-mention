// Pure token operations. No skill content is ever expanded here.
export function mentionAt(text, start, end = start) {
  if (start !== end) return null;
  const match = /(^|\s|[（(【\[])\$([\p{L}\p{N}_.:-]*)$/u.exec(
    text.slice(0, start),
  );
  if (!match) return null;
  const from = start - match[2].length - 1;
  const tail = /^[\p{L}\p{N}_.:-]*/u.exec(text.slice(start))[0];
  return { start: from, end: start + tail.length, query: match[2] };
}

export function normalizeSkills(skills) {
  const unique = new Map();
  for (const skill of skills ?? []) {
    if (
      !skill ||
      typeof skill.name !== "string" ||
      !/^[\p{L}\p{N}_.:-]+$/u.test(skill.name)
    )
      continue;
    if (!unique.has(skill.name))
      unique.set(skill.name, {
        name: skill.name,
        description: String(skill.description ?? ""),
      });
  }
  return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function filterSkills(skills, query) {
  const q = query.toLowerCase();
  if (!q) return skills;
  // Rank exact matches first, then name prefixes, then any name containing
  // the query. Catalog order (alphabetical) is kept within each rank.
  const ranked = [];
  skills.forEach((s, i) => {
    const name = s.name.toLowerCase();
    if (name === q) ranked.push({ i, rank: 0, s });
    else if (name.startsWith(q)) ranked.push({ i, rank: 1, s });
    else if (name.includes(q)) ranked.push({ i, rank: 2, s });
  });
  ranked.sort((a, b) => a.rank - b.rank || a.i - b.i);
  return ranked.map((r) => r.s);
}

export function insertSkill(text, token, name) {
  const after = text.slice(token.end);
  const inserted = `$${name}${/^\s/u.test(after) ? "" : " "}`;
  return {
    text: text.slice(0, token.start) + inserted + after,
    caret: token.start + inserted.length,
  };
}
