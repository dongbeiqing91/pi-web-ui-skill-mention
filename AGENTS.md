# AGENTS.md

## 项目与范围

这是 xing-shuyin/pi-web-ui 的独立 UI 插件，聊天输入框输入 `$` 或 `$prefix` 时补全技能名。仓库根目录即完整可安装插件目录，`manifest.json` 的插件 ID 固定为 `skill-mention`。

只插入 `$技能名` 文本。技能展开、提示词注入和模型调用由现有 pi-skills-mention / Pi 运行时负责。服务端 `index.mjs` 只提供只读技能元数据和状态路由。不要发送聊天消息、注册 AI 工具或复制技能展开逻辑。

## 文件职责

- `client/core.mjs`：纯函数，处理词元识别、技能名校验、过滤和光标范围替换。
- `client/entry.mjs`：公开 composer 锚点、补全浮层、键盘事件、React 状态同步、清理和子路径支持。
- `index.mjs`：使用宿主 Pi SDK 的公开 loadSkills 获取名称与描述；读取插件设置，不返回技能正文。
- `manifest.json`：权限、预加载、宿主约束和配置字段。
- `tests/core.test.mjs`：纯逻辑与只读路由契约。
- `tests/browser.test.mjs`、`tests/fixture.jsx`：真实浏览器与 React 19 受控输入框测试；宿主 API 在此为测试替身。
- `README.md`：用户安装、配置、使用、接口依据与已知限制。
- `VERIFICATION.md`：区分替身测试、实际宿主验证和未验证事项。

## 宿主接口规则

1. 修改前查阅目标版本的官方文档、类型和示例；不要从旧聊天记录推断接口。README 中记录了最初核对的版本和固定提交链接。
2. 优先公开 API，不修改 pi-web-ui 主仓库。当前使用 `window.__piWebUiHost.dom.anchors().composer`；其内部 textarea 结构没有稳定保证，升级时须重新检查。
3. `composerProviders` 在已核对版本只支持 `@`。不要添加宿主不存在的 `trigger:"$"` 等参数。如果未来新增公开 `$` 接口，再评估迁移。
4. 完整 DOM 操作需要声明 `dom` 并走宿主授权流程，不通过 `dom:anchor` 声明规避整页访问权限。
5. 服务端 `apiVersion` / `requires.hostApi` 与客户端 `host.version` 是两种版本：已核对版本分别为 2 和 11，composer 锚点最低客户端版本为 7。
6. SDK 使用宿主现有副本。不要把 Pi SDK 添加为运行 dependencies，也不要实例化第二个 agent runtime。定位失败时明确显示错误并保留手动 catalog 路径。
7. 自动发现不是活动会话的 resourceLoader 快照。额外技能路径、禁用列表和多客户端共享 cwd 的限制必须准确记录，不宣称自动同步。

## 交互与清理

- 保留消息两侧文本，光标只移动到插入词元后；支持一条消息的多个技能。
- 仅在匹配列表可用时拦截上下键、Enter、Tab，防止选择技能时误发；保留带修饰键组合的宿主行为。
- 输入法组字期间不补全、不拦 Enter；不得操作 composer 之外的表单。
- 用原生 textarea setter 和冒泡 input 事件同步 React 状态，不能只修改 DOM 的显示值。
- 技能名和描述用 textContent / text node 渲染，不把技能元数据当 HTML。
- 请求结果不能覆盖较新的状态或重新打开已经关闭的列表。
- 浮层使用 body portal 和 fixed 布局，兼顾滚动、窄屏和 visualViewport。
- 所有监听器、定时器、样式、浮层和在途请求必须可清理。保持热重载单例与幂等 dispose；不要假定 preload 有公开卸载回调。
- 请求路径由实际模块 URL 推导应用前缀，不能写死根路径，必须保留 `/pi/` 等反向代理子路径兼容性。

## 验证与交付

Node.js 22.19+。运行时无需构建；package.json 的依赖只供开发测试。

```sh
npm ci
npm test
npm run test:browser
```

浏览器测试默认查找 macOS Google Chrome；其他系统运行 `npx playwright install chromium`，或设置 CHROME_PATH。格式遵循现有代码风格；不要为了测试安装修改实际用户服务配置。

按变更范围验证：

- 词元/过滤/插入：单元测试；交互、事件或 DOM 修改还需浏览器测试。
- manifest 或服务端接口：用目标宿主校验器、官方安装器及真实 PluginManager，在隔离数据目录验证。
- SDK 来源：用临时技能目录验证全局、项目和额外路径，只读元数据中不出现技能正文。
- 真服务联调需用户授权，不发送真实提示词来测试补全。清楚标注合成 IME 事件与系统输入法实测的区别。
- 功能、代码或静态资源变更同步递增 manifest.json 和 package.json 的版本；更新锁文件的根版本。纯文档修改无需递增。
- 行为、接口或限制变化同步更新 README 与 VERIFICATION，不把模拟测试写成完整运行验证。

提交前检查 git diff 和文件列表。禁止提交 node_modules、用户配置/授权表、凭据、私人路径、运行日志、浏览器缓存、临时截图或测试数据。只操作当前插件仓库；没有用户要求时不发布 npm 包、不部署、不创建其他仓库。
