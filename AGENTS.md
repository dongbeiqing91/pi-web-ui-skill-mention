# AGENTS.md

## Project and Scope

This is an independent UI plugin for xing-shuyin/pi-web-ui. It completes skill names when the user types `$` or `$prefix` in the chat composer. The repository root is the complete installable plugin directory. The plugin ID in `manifest.json` remains `skill-mention`.

Insert only `$skill-name` text. Skill expansion, prompt injection, and model calls belong to the existing pi-skills-mention extension and Pi runtime. Server-side `index.mjs` provides only read-only skill metadata and status routes. Do not send chat messages, register agent tools, or duplicate skill expansion logic.

## File Responsibilities

- `client/core.mjs`: pure functions for token recognition, skill name validation, filtering, and caret-range replacement.
- `client/entry.mjs`: public composer anchor integration, popup, keyboard events, React state synchronization, cleanup, and deployment subpath support.
- `index.mjs`: read names and descriptions through the host Pi SDK's public `loadSkills`; read plugin settings without returning skill bodies.
- `manifest.json`: permissions, preloading, host requirements, and configuration fields.
- `tests/core.test.mjs`: pure logic and read-only route contracts.
- `tests/browser.test.mjs` and `tests/fixture.jsx`: real-browser tests with a React 19 controlled textarea; the host API is a test double here.
- `README.md` and `README.zh.md`: English and Chinese installation, configuration, usage, API evidence, and limitations. Keep both versions consistent and retain their language links.
- `VERIFICATION.md`: distinguish fixture tests, actual host checks, and unverified behavior.

## Host API Rules

1. Before changing an integration, check the target version's official documentation, types, and examples. Do not infer APIs from old chat history. The README records the originally checked version and fixed commit links.
2. Prefer public APIs and do not modify the pi-web-ui repository. The current integration uses `window.__piWebUiHost.dom.anchors().composer`. Its internal textarea structure is not guaranteed to remain stable; recheck it when upgrading.
3. In the checked version, `composerProviders` supports only `@`. Do not invent unsupported parameters such as `trigger:"$"`. Reconsider the integration if the host adds a public `$` interface.
4. Full DOM operations require declared `dom` permission and the host authorization flow. Do not use `dom:anchor` to bypass authorization for page-wide access.
5. Server-side `apiVersion` / `requires.hostApi` and client-side `host.version` are separate versions. The checked version uses 2 and 11 respectively; composer anchors require client API v7 or newer.
6. Use the host's existing SDK. Do not add the Pi SDK as a runtime dependency or instantiate a second agent runtime. If resolution fails, report the error and retain the manual catalog option.
7. Automatic discovery is not a snapshot of the active conversation's `resourceLoader`. Document extra paths, disabled skills, and shared cwd limitations accurately; do not claim automatic synchronization.

## Interaction and Cleanup

- Preserve text surrounding a token and move the caret only to the end of the insertion. Support multiple skills in one message.
- Intercept arrow keys, Enter, and Tab only when matching results are available, preventing accidental sends during selection. Preserve the host behavior of modified shortcuts.
- Suspend completion and Enter interception during IME composition. Do not operate on forms outside the composer.
- Use the native textarea setter and a bubbling input event to synchronize React state; changing only the visible DOM value is insufficient.
- Render names and descriptions with `textContent` or text nodes. Never treat skill metadata as HTML.
- A request result must not overwrite newer state or reopen a dismissed list.
- Use a body portal with fixed positioning for the popup; handle scrolling, narrow screens, and `visualViewport`.
- All listeners, timers, styles, popup nodes, and pending requests must be disposable. Preserve the hot-reload singleton and idempotent `dispose`; do not assume a public unload callback exists for preloaded modules.
- Derive request prefixes from the actual module URL. Do not hardcode root-relative paths; preserve reverse-proxy subpaths such as `/pi/`.

## Verification and Delivery

Use Node.js 22.19+. No runtime build is required. Dependencies in `package.json` are for development tests only.

```sh
npm ci
npm test
npm run test:browser
```

Browser tests look for Google Chrome on macOS by default. On other systems, run `npx playwright install chromium` or set `CHROME_PATH`. Follow the existing formatting style. Do not change the user's actual service configuration just to set up tests.

Verify according to the change:

- Token recognition, filtering, or insertion: run unit tests. Interaction, events, or DOM changes also require browser tests.
- Manifest or server interfaces: use the target host's validator, official installer, and real PluginManager in an isolated data directory.
- SDK discovery: use temporary skill directories to verify global, project, and additional sources; skill bodies must not appear in metadata responses.
- Actual service integration requires user authorization. Do not send real prompts to test completion. Distinguish synthetic IME events from operating-system input method tests.
- Code, feature, or static asset changes require matching version bumps in `manifest.json` and `package.json`, plus the lockfile root version. Documentation-only changes do not require a version bump.
- Update both READMEs and the verification record when behavior, APIs, or limitations change. Do not describe fixture tests as complete host verification.

Before committing, inspect the diff and file list. Never commit `node_modules`, user configuration or consent records, credentials, private paths, runtime logs, browser caches, temporary screenshots, or test data. Work only in this plugin repository. Do not publish an npm package, deploy, or create other repositories unless the user requests it.
