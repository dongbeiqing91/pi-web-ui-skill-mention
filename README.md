# pi-web-ui $skill Autocomplete

English | [简体中文](README.zh.md)

Type `$` or a partial skill name in the chat composer to open a skill list. Results update as you type, matching skill names case-insensitively: exact and prefix matches come first, followed by any skill whose name contains the query. Use the arrow keys to select, Enter or Tab to insert, and Esc to dismiss. Mouse and touch selection are also supported, as are multiple skill mentions in one message:

```text
$code-review $frontend-design Review this page for me
```

The plugin inserts plain `$skill-name` text. It does not send messages, inject skill instructions, or register agent tools. Your existing **pi-skills-mention** extension handles skill expansion; enable it in the Pi runtime used by pi-web-ui.

## Prerequisites

**Install and enable `pi-skills-mention` in Pi before installing this UI plugin if you want `$skill-name` mentions to load skill instructions.**

- **Host:** xing-shuyin/pi-web-ui, checked and tested with version `0.104.4`, running on Node.js `22.19+`.
- **Skill expansion:** `pi-skills-mention` must be enabled in the same Pi runtime and agent configuration directory used by pi-web-ui.
- **Skills:** the skills you intend to mention must be installed and available to that runtime. Match any additional sources in this plugin's `skillPaths` settings.

On the machine running Pi and pi-web-ui, install the extension:

```sh
pi install npm:pi-skills-mention
```

Then restart Pi or run `/reload` in the Pi session used by pi-web-ui to reload extensions. If your service uses a custom `PI_CODING_AGENT_DIR`, install into that same configuration directory. Installing the extension into a different Pi environment will not enable it for your web session.

**Without `pi-skills-mention`, the UI can still display suggestions and insert `$skill-name`, but this plugin will not expand those mentions into skill instructions.** A working popup alone does not confirm backend expansion.

## Installation

After completing the prerequisites above, install the UI plugin. It uses native ESM and needs no build step or additional runtime dependencies.

Install directly from GitHub:

```sh
pi-web-ui install dongbeiqing91/pi-web-ui-skill-mention
```

Alternatively, clone this repository or extract the installation archive:

1. Locate the directory containing `manifest.json`.
2. On the machine running pi-web-ui, install that directory using its absolute path:

   ```sh
   pi-web-ui install "/absolute/path/skill-mention"
   ```

   If your service uses a custom data directory, pass the same directory:

   ```sh
   pi-web-ui install "/absolute/path/skill-mention" --data-dir "/absolute/path/pi-web-data"
   ```

   The default destination is `~/.pi-web/plugins/skill-mention/`, or the data directory specified by `PI_WEB_DATA_DIR`. For a remote deployment, transfer the plugin to the server and install it there; a client-side directory is not uploaded automatically.

3. Refresh pi-web-ui. Open **Settings → UI Plugins**, find the `$skill 自动补全` plugin, and enable it. Grant full DOM access in its plugin row; the button label may vary by locale. If it still reports missing permission after authorization, use the plugin page's rescan/reload action and refresh again. The tested host version may retain the pre-authorization catalog error.
4. Type `$` in the composer. If no catalog is available, configure additional paths or a manual catalog as described below.

DOM authorization is required because the current public composer provider API supports only `@`, with no `$` trigger interface. The plugin declares full `dom` permission and uses the host's authorization flow. It reads composer text and writes the selected token back. DOM permission itself permits access to the entire page, so review the source before granting it.

To update, repeat the installation command with `--force`. The official installer backs up the previous directory and preserves existing configuration. To uninstall:

```sh
pi-web-ui uninstall skill-mention
```

Include `--data-dir` when uninstalling from a custom data directory. Refresh the page after uninstalling, disabling the plugin, or revoking permission to immediately remove its loaded client code.

## Skill Sources and Configuration

Set these fields in the plugin settings. After saving, leave the current token and type a new `$` to reload the catalog:

| Field            | Purpose                                               | Example                                                |
| ---------------- | ----------------------------------------------------- | ------------------------------------------------------ |
| `skillPaths`     | Additional directories or SKILL.md paths              | `["/Users/me/.agents/skills"]`                         |
| `excludedSkills` | Skill names to hide                                   | `["internal-only"]`                                    |
| `catalog`        | A nonempty array replaces automatic discovery         | `[{"name":"code-review","description":"Review code"}]` |
| `projectCwd`     | Fixed project directory; blank uses public `host.cwd` | `/Users/me/projects/demo`                              |

Automatic discovery uses the **Pi SDK's public `loadSkills({cwd, agentDir, skillPaths, includeDefaults:true})`**. It reads `<agentDir>/skills` and `<cwd>/.pi/skills` by default. `agentDir` comes from `PI_CODING_AGENT_DIR` or defaults to `~/.pi/agent`. The SDK parses skill names and descriptions; the plugin does not implement its own YAML parser. It uses the host's existing SDK. If SDK resolution fails, it displays an error, and a manual `catalog` remains available.

This is an **independent completion catalog**, not a snapshot of the active conversation's `resourceLoader`. The public client API does not expose that snapshot:

- If pi-skills-mention loads skills from additional directories, ancestor `.agents/skills` directories, npm packages, or custom sources, configure matching `skillPaths` or use a manual `catalog`.
- Skills disabled in the host settings are not automatically excluded here. Keep `excludedSkills` in sync. A skill appearing in the list does not prove that the backend has loaded it.
- `host.cwd` is shared across the plugin host. When multiple browser clients use different projects, another client's project switch may change it. A fixed `projectCwd` or manual `catalog` controls this plugin's catalog, but that configuration is also shared across clients. The current API cannot reliably identify each tab's active conversation directory.
- Duplicate names appear once. Names accept letters, numbers, and `_ . : -`; whitespace, `$`, and HTML characters are rejected.

These limitations do not change backend skill expansion. The skills actually loaded by pi-skills-mention determine what can be expanded.

## Interaction Details

- `$` must appear at the start of a message, after whitespace or a newline, or after an opening bracket. `abc$foo`, `\$foo`, and `$$foo` do not trigger completion.
- With the caret inside a token, filtering uses the text to the left of the caret. Selection replaces the entire token while preserving surrounding text. A text selection does not trigger completion.
- After insertion, the caret stays after the skill token, with a space added when needed. Type another `$` to insert a second skill.
- Enter and Tab are intercepted only when matching results are available, preventing an accidental send while choosing a skill. While loading, on catalog errors, or with no matches, the host's normal key behavior remains in effect. Modified shortcuts such as Shift+Enter retain their normal behavior.
- Esc or clicking outside dismisses the list. Changing the token can reopen it. Completion and Enter interception are suspended during IME composition.
- The list is positioned above or below the composer rather than at the exact character caret. It adjusts to scrolling, window changes, and the mobile visual viewport.
- Only editable `textarea` elements within the public composer anchor are handled. Other forms are ignored. The host provides a stable anchor, but its internal textarea structure may change in future versions.

## API References

Checked on 2026-10-12 against upstream main commit `22af48d65a581e42ce0a0723e253645e23e23d1c`, package version `0.104.4`.

| Interface                                                          | Implementation evidence                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `window.__piWebUiHost.dom.anchors().composer`                      | [plugin-host.ts](https://github.com/xing-shuyin/pi-web-ui/blob/22af48d65a581e42ce0a0723e253645e23e23d1c/web/src/plugin-host.ts); introduced in client API v7, currently v11 in the checked version                                                                                                                |
| `composerProviders.register({id,label,search})`                    | The same source supports only `@` providers and has no `trigger` field; this plugin does not invent a `$` registration parameter                                                                                                                                                                                  |
| `view:false`, `preload:true`                                       | [plugin-loader.ts](https://github.com/xing-shuyin/pi-web-ui/blob/22af48d65a581e42ce0a0723e253645e23e23d1c/web/src/plugin-loader.ts) and the [notes example](https://github.com/xing-shuyin/pi-web-ui/tree/22af48d65a581e42ce0a0723e253645e23e23d1c/plugins/notes); load ESM top-level code when entering the page |
| `activate(host)`, `host.route()`, `host.getSettings()`, `host.cwd` | [plugin-sdk/index.d.ts](https://github.com/xing-shuyin/pi-web-ui/blob/22af48d65a581e42ce0a0723e253645e23e23d1c/plugin-sdk/index.d.ts); used for read-only `/skills` and `/status` routes                                                                                                                          |
| DOM permissions and installation                                   | [Plugin architecture](https://github.com/xing-shuyin/pi-web-ui/blob/22af48d65a581e42ce0a0723e253645e23e23d1c/docs/architecture-plugins.md) and [CLI](https://github.com/xing-shuyin/pi-web-ui/blob/22af48d65a581e42ce0a0723e253645e23e23d1c/bin/pi-web-ui.mjs)                                                    |
| SDK resolution                                                     | Host [resolve-global-sdk.ts](https://github.com/xing-shuyin/pi-web-ui/blob/22af48d65a581e42ce0a0723e253645e23e23d1c/server/resolve-global-sdk.ts), plus the exports and types of the installed `@earendil-works/pi-coding-agent@1.1.0`                                                                            |

`manifest.apiVersion:2` and `requires.hostApi:2` refer to **server-side plugin facilities**. The client has a separate `host.version`, checked at runtime to be at least 7. Do not mix these versions. `engines` declares the tested host minimum, but upstream allows activation if it cannot read its own version, so that declaration is not a strict compatibility guarantee.

The host's `compose()` appends draft content and cannot precisely replace a caret range. This plugin uses the native textarea value setter and a bubbling input event to synchronize React state. It does not share a React instance or modify the host repository.

In the checked version, preloaded client modules have no public unload callback. A global singleton disposes the previous instance on hot reload. Every 10 seconds, read-only checks of the client file and `/status` detect 403/404 responses caused by disabling, deletion, or permission revocation and clean up the plugin. Temporary network failures do not trigger cleanup. Refreshing the page remains the immediate, reliable cleanup method.

## Verification

See [VERIFICATION.md](VERIFICATION.md) for the detailed record, currently in Chinese. Checks passed for the official installer, real PluginManager activation and routes, real Pi SDK metadata, seven unit tests, and Chrome with a React 19 controlled textarea fixture. Tab/Enter insertion and multiple mentions were also verified in an actual pi-web-ui 0.104.4 chat page, with no page JavaScript errors; that real-page check predates the substring matching change, so ranked filtering has not yet been re-verified there. No test chat message was sent, and final expansion by pi-skills-mention has not been verified.

Development dependencies are for testing only and are not needed to install the plugin:

```sh
cd "/absolute/path/skill-mention"
npm test
npm ci
npm run test:browser
```

The browser test defaults to Google Chrome on macOS. On other platforms, run `npx playwright install chromium` or set `CHROME_PATH` to the browser executable's absolute path.

## Repository Layout

```text
skill-mention/
├── manifest.json
├── index.mjs               # Read-only skill metadata; no expansion
├── client/
│   ├── entry.mjs           # Public anchor integration, popup, keyboard handling
│   └── core.mjs            # Pure token, filtering, and insertion functions
├── tests/
│   ├── core.test.mjs
│   ├── browser.test.mjs
│   └── fixture.jsx
├── package.json            # Development dependencies only
├── README.md               # English documentation
├── README.zh.md            # Chinese documentation
├── AGENTS.md               # Development constraints and verification requirements
├── package-lock.json
├── VERIFICATION.md
└── LICENSE
```

## Development and Contributions

See [AGENTS.md](AGENTS.md) for development constraints. Run unit and browser tests when changing interactions. Check the host SDK's actual public interfaces when changing catalog discovery. Code or feature changes require matching version bumps in `manifest.json` and `package.json`.

Licensed under MIT; see [LICENSE](LICENSE).
