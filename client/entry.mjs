import {
  mentionAt,
  normalizeSkills,
  filterSkills,
  insertSkill,
} from "./core.mjs";

export function install(host, catalogUrl) {
  if (!host || host.version < 7 || !host.dom?.anchors)
    throw new Error("skill-mention 需要客户端 host API v7+。");
  const doc = document;
  const abort = new AbortController();
  const cleanups = [];
  let disposed = false,
    composing = false,
    target = null,
    token = null;
  let skills = [],
    hits = [],
    selected = 0,
    loading = false,
    error = "";
  let dismissed = "",
    requestId = 0,
    refreshKey = "";
  const panel = doc.createElement("div");
  panel.id = "pi-skill-mention-list";
  panel.setAttribute("role", "listbox");
  panel.setAttribute("aria-label", "技能补全");
  panel.hidden = true;
  const style = doc.createElement("style");
  style.textContent = `
    #pi-skill-mention-list {position:fixed;z-index:10000;box-sizing:border-box;max-height:260px;overflow:auto;overscroll-behavior:contain;padding:6px;border:1px solid #777;border-radius:10px;background:var(--bg,#202127);color:var(--text,#eee);box-shadow:0 8px 30px #0005;font:13px system-ui;}
    #pi-skill-mention-list[hidden]{display:none}
    #pi-skill-mention-list button {display:block;box-sizing:border-box;width:100%;text-align:left;background:transparent;color:inherit;border:0;padding:8px;border-radius:6px;cursor:pointer;overflow-wrap:anywhere;}
    #pi-skill-mention-list button[aria-selected=true]{background:#3765ac;color:white;}
    #pi-skill-mention-list small {display:block;opacity:.8;overflow-wrap:anywhere;}
    #pi-skill-mention-list .status {padding:8px;overflow-wrap:anywhere;}
  `;
  doc.head.append(style);
  doc.body.append(panel);

  function listen(el, name, fn, options) {
    el.addEventListener(name, fn, options);
    cleanups.push(() => el.removeEventListener(name, fn, options));
  }
  function composerInput(el) {
    const anchor = host.dom.anchors().composer;
    return (
      el instanceof HTMLTextAreaElement &&
      anchor?.contains(el) &&
      !el.disabled &&
      !el.readOnly
    );
  }
  function signature() {
    return target && token
      ? `${token.start}:${token.end}:${target.value}:${target.selectionStart}`
      : "";
  }
  function clearAria() {
    if (!target) return;
    // Remove only attributes owned by this plugin; leave native @/slash semantics alone.
    if (target.getAttribute("aria-controls") === panel.id)
      target.removeAttribute("aria-controls");
    if (
      target.getAttribute("aria-activedescendant")?.startsWith(`${panel.id}-`)
    )
      target.removeAttribute("aria-activedescendant");
  }
  function close() {
    panel.hidden = true;
    clearAria();
  }
  function position() {
    if (panel.hidden || !target?.isConnected) return;
    const r = target.getBoundingClientRect();
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft || 0,
      top = viewport?.offsetTop || 0;
    const width = viewport?.width || window.innerWidth,
      height = viewport?.height || window.innerHeight;
    panel.style.width = `${Math.min(480, Math.max(160, r.width), width - 16)}px`;
    panel.style.left = `${Math.max(left + 8, Math.min(r.left, left + width - panel.offsetWidth - 8))}px`;
    const above = r.top - top - 8,
      below = top + height - r.bottom - 8;
    const upward = above >= Math.min(260, panel.scrollHeight) || above > below;
    panel.style.maxHeight = `${Math.max(40, Math.min(260, upward ? above : below))}px`;
    panel.style.top = `${upward ? Math.max(top + 8, r.top - panel.offsetHeight - 6) : r.bottom + 6}px`;
  }
  function render() {
    if (
      !target ||
      !token ||
      composing ||
      doc.activeElement !== target ||
      signature() === dismissed
    ) {
      close();
      return;
    }
    hits = filterSkills(skills, token.query);
    selected = Math.min(selected, Math.max(0, hits.length - 1));
    panel.replaceChildren();
    if (loading || error || !hits.length) {
      const status = doc.createElement("div");
      status.className = "status";
      status.textContent = loading ? "读取技能…" : error || "没有匹配的技能";
      panel.append(status);
    } else
      hits.forEach((skill, i) => {
        const row = doc.createElement("button");
        row.type = "button";
        row.id = `${panel.id}-${i}`;
        row.setAttribute("role", "option");
        row.setAttribute("aria-selected", String(i === selected));
        row.tabIndex = -1;
        row.append(doc.createTextNode(`$${skill.name}`));
        const description = doc.createElement("small");
        description.textContent = skill.description;
        row.append(description);
        row.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          selected = i;
          accept();
        });
        panel.append(row);
      });
    panel.hidden = false;
    target.setAttribute("aria-controls", panel.id);
    if (hits.length && !loading && !error)
      target.setAttribute("aria-activedescendant", `${panel.id}-${selected}`);
    else target.removeAttribute("aria-activedescendant");
    position();
    panel.children[selected]?.scrollIntoView({ block: "nearest" });
  }
  async function refresh() {
    const id = ++requestId;
    loading = true;
    error = "";
    skills = [];
    render();
    try {
      const response = await fetch(catalogUrl, {
        credentials: "same-origin",
        cache: "no-store",
        signal: abort.signal,
      });
      if (disposed || id !== requestId) return;
      if (response.status === 404 || response.status === 403) {
        dispose();
        return;
      }
      const data = await response.json();
      if (!response.ok || !data.ok)
        throw new Error(data.error || `HTTP ${response.status}`);
      skills = normalizeSkills(data.skills);
    } catch (e) {
      if (disposed || id !== requestId) return;
      error = `技能目录不可用：${e.message}`;
    }
    if (disposed || id !== requestId) return;
    loading = false;
    render();
  }
  function update(el) {
    if (!composerInput(el)) {
      close();
      return;
    }
    const changed = target !== el;
    if (changed) {
      close();
      target = el;
      refreshKey = "";
      dismissed = "";
    }
    const next = mentionAt(el.value, el.selectionStart, el.selectionEnd);
    if (!next) {
      token = null;
      refreshKey = "";
      dismissed = "";
      close();
      return;
    }
    if (!token || token.query !== next.query || token.start !== next.start)
      selected = 0;
    token = next;
    if (signature() !== dismissed) dismissed = "";
    const key = `${token.start}`;
    if (key !== refreshKey) {
      refreshKey = key;
      void refresh();
    }
    render();
  }
  function accept() {
    if (loading || error || !hits[selected] || !target || !token) return;
    // Re-check caret/value at the moment of accepting; never apply a stale range.
    const now = mentionAt(
      target.value,
      target.selectionStart,
      target.selectionEnd,
    );
    if (!now || now.start !== token.start || now.query !== token.query) {
      update(target);
      return;
    }
    const result = insertSkill(target.value, now, hits[selected].name);
    // Native setter bypasses React's value tracker so the bubbling input updates its state.
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    ).set.call(target, result.text);
    target.setSelectionRange(result.caret, result.caret);
    close();
    token = null;
    refreshKey = "";
    dismissed = "";
    target.dispatchEvent(new Event("input", { bubbles: true }));
    target.focus();
  }
  listen(
    doc,
    "input",
    (e) => {
      if (!composing) update(e.target);
    },
    true,
  );
  listen(doc, "focusin", (e) => update(e.target), true);
  listen(doc, "selectionchange", () => {
    if (!composing) update(doc.activeElement);
  });
  listen(
    doc,
    "compositionstart",
    (e) => {
      if (composerInput(e.target)) {
        composing = true;
        close();
      }
    },
    true,
  );
  listen(
    doc,
    "compositionend",
    (e) => {
      composing = false;
      update(e.target);
    },
    true,
  );
  listen(
    doc,
    "keydown",
    (e) => {
      if (
        !composerInput(e.target) ||
        composing ||
        e.isComposing ||
        e.keyCode === 229
      )
        return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (panel.hidden) return;
      if (e.key === "Escape") {
        dismissed = signature();
        close();
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (!hits.length || loading || error) return;
        selected =
          (selected + (e.key === "ArrowDown" ? 1 : hits.length - 1)) %
          hits.length;
        render();
      } else if (e.key === "Enter" || e.key === "Tab") {
        if (!hits.length || loading || error) return;
        accept();
      } else return;
      e.preventDefault();
      e.stopImmediatePropagation();
    },
    true,
  );
  listen(
    doc,
    "pointerdown",
    (e) => {
      if (!panel.contains(e.target) && e.target !== target) {
        dismissed = signature();
        close();
      }
    },
    true,
  );
  listen(
    doc,
    "focusout",
    () =>
      queueMicrotask(() => {
        if (doc.activeElement !== target) close();
      }),
    true,
  );
  listen(window, "resize", position);
  listen(doc, "scroll", position, true);
  if (window.visualViewport) {
    listen(window.visualViewport, "resize", position);
    listen(window.visualViewport, "scroll", position);
  }
  if (host.onViewChange)
    cleanups.push(
      host.onViewChange(() => {
        dismissed = signature();
        close();
        refreshKey = "";
      }),
    );
  // Preload modules have no unload hook in the verified loader. A read-only lease
  // detects removal/disable/DOM revocation; reload remains the immediate cleanup path.
  const lease = setInterval(async () => {
    try {
      const url = new URL(
        "./entry.mjs",
        catalogUrl.replace(
          /plugins-api\/skill-mention\/skills$/,
          "plugins/skill-mention/client/",
        ),
      );
      const responses = await Promise.all([
        fetch(url, { method: "HEAD", cache: "no-store", signal: abort.signal }),
        fetch(catalogUrl.replace(/\/skills$/, "/status"), {
          cache: "no-store",
          signal: abort.signal,
        }),
      ]);
      if (
        responses.some(
          (response) => response.status === 403 || response.status === 404,
        )
      )
        dispose();
    } catch {
      /* A transient network failure does not disable completion. */
    }
    if (target && (!target.isConnected || !composerInput(target))) {
      close();
      target = null;
      token = null;
      refreshKey = "";
    }
  }, 10000);
  cleanups.push(() => clearInterval(lease));
  function dispose() {
    if (disposed) return;
    disposed = true;
    requestId++;
    abort.abort();
    close();
    for (const cleanup of cleanups.reverse()) cleanup();
    panel.remove();
    style.remove();
  }
  update(doc.activeElement);
  return dispose;
}

// Resolve reverse-proxy subpaths from the actual bundle URL, not page pathname.
const marker = "/plugins/skill-mention/client/";
const entryUrl = new URL(import.meta.url);
const markerAt = entryUrl.pathname.lastIndexOf(marker);
if (typeof window !== "undefined" && markerAt >= 0) {
  const key = Symbol.for("pi-web-ui.skill-mention.dispose");
  window[key]?.();
  const catalogUrl = `${entryUrl.origin}${entryUrl.pathname.slice(0, markerAt)}/plugins-api/skill-mention/skills`;
  window[key] = install(window.__piWebUiHost, catalogUrl);
}
