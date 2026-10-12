# pi-web-ui $skill 自动补全

在聊天输入框输入 `$` 或 `$prefix`，显示技能列表。实时按技能名前缀过滤，忽略大小写；上下键循环选择，Enter / Tab 插入，Esc 关闭。支持鼠标/触屏选择，以及一条消息中插入多个技能：

```text
$code-review $frontend-design 帮我检查这个页面
```

插件只插入纯文本 `$技能名`，不发送消息、不注入技能正文、不注册 AI 工具。技能展开由你已有的 **pi-skills-mention** 负责；请确保它在 pi-web-ui 使用的 Pi 运行时里启用。

## 安装

已核对并测试 **xing-shuyin/pi-web-ui 0.104.4**。Node.js 使用宿主要求的 **22.19+**。插件为原生 ESM，无需构建或安装运行依赖。

推荐直接从 GitHub 安装：

```sh
pi-web-ui install dongbeiqing91/pi-web-ui-skill-mention
```

也可先克隆本仓库，再按以下本地目录方式安装。

1. 克隆本仓库或解压安装包，找到含有 `manifest.json` 的目录。
2. 在运行 pi-web-ui 的机器上执行（路径换成源码目录的完整路径）：

   ```sh
   pi-web-ui install "/absolute/path/skill-mention"
   ```

   如果服务使用自定义数据目录，安装时也指定同一目录：

   ```sh
   pi-web-ui install "/absolute/path/skill-mention" --data-dir "/absolute/path/pi-web-data"
   ```

   默认目标是 `~/.pi-web/plugins/skill-mention/`，或环境变量 `PI_WEB_DATA_DIR` 指定的数据目录。远程部署需把目录传到服务器后在那里安装；客户端电脑上的目录不会自动上传。

3. 刷新 pi-web-ui，打开 **设置 → 界面插件**，找到 `$skill 自动补全` 并启用。在该插件行点击 **授权完全 DOM 访问**（按钮文案可能随语言变化）。若授权后仍提示未授权，点击插件页的重新扫描/重载按钮，再刷新页面；已测试版本可能保留授权前的清单错误。
4. 在聊天输入框输入 `$`。若目录不可用，按下方说明配置额外路径或手动技能目录。

这里需要 DOM 授权，是因为当前公开补全提供者只支持 `@`，没有 `$` 触发器接口。授权由 pi-web-ui 自己的设置流程管理；插件声明完整 `dom` 权限，不绕过授权。它读取聊天输入框文字并写回选中的词元；DOM 权限本身允许访问整页，请审阅源码后授权。

更新使用相同命令加 `--force`；官方安装器会备份旧目录并保留已有配置。卸载：

```sh
pi-web-ui uninstall skill-mention
```

自定义数据目录卸载同样加 `--data-dir`。卸载、禁用或撤销授权后建议刷新页面以立即清理已加载的客户端代码。

## 技能来源与配置

在插件设置中填写以下字段，保存后离开当前词元，再输入一个新的 `$` 即重新读取目录：

| 字段             | 用途                                   | 示例                                                |
| ---------------- | -------------------------------------- | --------------------------------------------------- |
| `skillPaths`     | 自动发现之外的目录或 SKILL.md 路径     | `["/Users/me/.agents/skills"]`                      |
| `excludedSkills` | 不显示的技能名                         | `["internal-only"]`                                 |
| `catalog`        | 非空时替代自动发现，明确控制可补全技能 | `[{"name":"code-review","description":"代码审查"}]` |
| `projectCwd`     | 固定项目目录；留空用公开 `host.cwd`    | `/Users/me/projects/demo`                           |

自动发现通过 **Pi SDK 的公开 `loadSkills({cwd, agentDir, skillPaths, includeDefaults:true})`**，默认读取 `<agentDir>/skills` 和 `<cwd>/.pi/skills`；`agentDir` 使用 `PI_CODING_AGENT_DIR` 或 `~/.pi/agent`。用 SDK 解析技能名和描述，不自行猜测 YAML。宿主已有 SDK 优先；不能定位 SDK 时明确显示错误，手动 `catalog` 仍可使用。

这是一个**独立的补全目录**，不是当前对话的 `resourceLoader` 快照。公开客户端 API 没有暴露该快照：

- pi-skills-mention 若从额外目录、祖先 `.agents/skills`、npm 包或自定义来源加载技能，请填入相同 `skillPaths`，或使用手动 `catalog`。
- 宿主设置中禁用的技能不会自动从本目录排除，请同步 `excludedSkills`。列表出现某技能不能证明后端已加载它。
- `host.cwd` 是插件宿主全局工作目录，多浏览器同时使用不同项目时会受其他客户端切换项目影响。固定 `projectCwd` 或手动 `catalog` 可控制本插件目录；此固定配置也由所有客户端共享。当前 API 无法可靠取得每个标签页的活动对话工作目录。
- 同名技能只显示一次；名称不含空白、`$`、HTML 字符，只接受字母、数字、`_ . : -`。

这些限制不会改变后端技能展开行为，最终可用技能以 pi-skills-mention 实际加载的目录为准。

## 交互细节

- `$` 必须位于消息开头、空白/换行后或左括号后；`abc$foo`、`\$foo`、`$$foo` 不触发。
- 光标在词元中间时按光标左侧前缀过滤，选中后替换完整词元，保留两侧正文。文本选择不触发补全。
- 插入后光标留在技能词元后，并在需要时添加空格。再次输入 `$` 可插入第二个技能。
- Enter / Tab 只有在匹配列表可用时被拦截，避免选择技能时误发消息。正在加载、目录错误或零匹配时保持宿主原有按键行为。Shift+Enter 等带修饰键组合保持原有行为。
- Esc 或点击外部会关闭列表；改变词元后可再次打开。中文输入法组字期间不补全、不拦 Enter。
- 列表锚定输入框上方或下方，而不是字符级光标位置；跟随窗口、滚动及移动端可视区域调整。
- 仅定位公开 composer 锚点下的可编辑 `textarea`，不处理其他表单。宿主公开承诺锚点稳定，锚点内的 textarea 结构仍可能随未来版本变化。

## 接口依据

核对日期：2026-10-12。上游 main 提交：`22af48d65a581e42ce0a0723e253645e23e23d1c`，package 版本 `0.104.4`。

| 实际接口                                                           | 用法与核对来源                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `window.__piWebUiHost.dom.anchors().composer`                      | [plugin-host.ts](https://github.com/xing-shuyin/pi-web-ui/blob/22af48d65a581e42ce0a0723e253645e23e23d1c/web/src/plugin-host.ts)，客户端 v7 引入；当前 v11                                                                                                                              |
| `composerProviders.register({id,label,search})`                    | 同一源码仅为 `@` 提供者，无 `trigger` 字段，因此未伪造 `$` 注册参数                                                                                                                                                                                                                    |
| `view:false`、`preload:true`                                       | [plugin-loader.ts](https://github.com/xing-shuyin/pi-web-ui/blob/22af48d65a581e42ce0a0723e253645e23e23d1c/web/src/plugin-loader.ts) 与 [notes 示例](https://github.com/xing-shuyin/pi-web-ui/tree/22af48d65a581e42ce0a0723e253645e23e23d1c/plugins/notes)，进入页面即加载 ESM 顶层代码 |
| `activate(host)`、`host.route()`、`host.getSettings()`、`host.cwd` | [plugin-sdk/index.d.ts](https://github.com/xing-shuyin/pi-web-ui/blob/22af48d65a581e42ce0a0723e253645e23e23d1c/plugin-sdk/index.d.ts)，提供只读 `/skills` 和 `/status` 路由                                                                                                            |
| DOM 权限与安装格式                                                 | [插件架构文档](https://github.com/xing-shuyin/pi-web-ui/blob/22af48d65a581e42ce0a0723e253645e23e23d1c/docs/architecture-plugins.md)、[CLI](https://github.com/xing-shuyin/pi-web-ui/blob/22af48d65a581e42ce0a0723e253645e23e23d1c/bin/pi-web-ui.mjs)                                   |
| SDK 解析                                                           | 宿主 [resolve-global-sdk.ts](https://github.com/xing-shuyin/pi-web-ui/blob/22af48d65a581e42ce0a0723e253645e23e23d1c/server/resolve-global-sdk.ts) 与实际安装的 `@earendil-works/pi-coding-agent@1.1.0` 导出/类型                                                                       |

`manifest.apiVersion:2` 和 `requires.hostApi:2` 指**服务端插件设施**；客户端版本另有 `host.version`，代码运行时检查其至少为 7。两种版本不能混用。`engines` 声明了已测试的宿主下限，但上游读取自身版本失败时会放行，因此不要只依赖它作兼容保证。

宿主 `compose()` 用来追加草稿，不能精确替换光标范围。本插件使用原生 textarea value setter + 冒泡 input 事件，让宿主 React 状态同步。无需共享 React 实例或修改主仓库。

前端 preload 模块在核对版本中没有公开的卸载回调。插件通过全局单例保证热重载前清理旧监听器；每 10 秒只读检查客户端文件与 `/status`，检测到禁用/删除/撤权产生的 403/404 后清理。网络暂时断开不清理。刷新页面是立即且可靠的清理方式。

## 验证

详见 [VERIFICATION.md](VERIFICATION.md)。已通过官方安装命令、真实 PluginManager 激活与路由检查、真实 Pi SDK 元数据检查、6 项单元测试，以及 Chrome + React 19 受控 textarea 浏览器测试。另已在实际运行的 pi-web-ui 0.104.4 聊天页面验证前缀过滤、Tab/Enter 插入和多个技能，页面无 JS 异常。未发送测试聊天消息，未验证 pi-skills-mention 的最终展开。

测试依赖仅供开发，不影响安装：

```sh
cd "/absolute/path/skill-mention"
npm test
npm ci
npm run test:browser
```

浏览器测试默认使用 macOS 的 Google Chrome；其他平台先执行 `npx playwright install chromium`，或通过 `CHROME_PATH` 指定浏览器完整可执行路径。

## 目录

```text
skill-mention/
├── manifest.json
├── index.mjs               # 只读技能元数据，不展开技能
├── client/
│   ├── entry.mjs           # 公开锚点接入、浮层与键盘操作
│   └── core.mjs            # 词元、过滤、插入纯函数
├── tests/
│   ├── core.test.mjs
│   ├── browser.test.mjs
│   └── fixture.jsx
├── package.json            # 仅含开发测试依赖
├── README.md
├── AGENTS.md              # 后续开发约束与验证要求
├── package-lock.json
├── VERIFICATION.md
└── LICENSE
```

## 开发与贡献

开发约束见 [AGENTS.md](AGENTS.md)。修改交互时运行单元测试和浏览器测试；修改技能目录读取时核对宿主 SDK 的实际公开接口。功能或代码变更需同步递增 `manifest.json` 和 `package.json` 的版本号。

本项目使用 MIT 许可证，见 [LICENSE](LICENSE)。
