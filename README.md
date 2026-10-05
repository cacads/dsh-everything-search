<div align="center">

# 🔍 Everything 全盘搜索

**DeepSeek Harness（DSH）插件** —— 基于 [Everything](https://www.voidtools.com/) 的全盘极速文件搜索 · 多选加入上下文 · 设置可自定义

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![platform](https://img.shields.io/badge/platform-DeepSeek%20Harness-8d7ce4.svg)](https://github.com/)
[![version](https://img.shields.io/badge/version-1.0.0-b08427.svg)](https://github.com/)

[✨ 功能](#-功能) · [📥 安装](#-安装) · [🖥 使用](#-使用) · [⚙️ 设置](#️-设置) · [❓ FAQ](#-常见问题)

</div>

---

## ✨ 功能

| 模块 | 能力 |
| --- | --- |
| **全盘极速搜索** | 调用 Everything 索引，瞬间搜遍全部硬盘（C / D / E / F …），比 `grep` / `glob` 更快更全 |
| **Everything 语法** | 支持 `*.pdf`、`ext:png`、`文件夹名\` 等 Everything 原生搜索语法 |
| **类型筛选** | 全部 / 文件夹 / 文件 三种范围，切换即自动重新搜索 |
| **文件夹限定** | 可指定「范围」文件夹路径，只搜该文件夹内（`-path`） |
| **多选加入上下文** | 搜索结果可勾选多个文件/文件夹，一键以 `@引用` 写入输入框，加入对话上下文 |
| **自定义设置** | 默认结果数量、默认类型、搜索引擎路径（es.exe）均可修改，localStorage 落盘 |
| **模型工具** | 注册 `everything_search` 工具，Agent 可直接询问"帮我找某个文件" |
| **es.exe 随包** | 搜索工具 es.exe 随插件打包在 `lib/es.exe`，随包即用，无需手动放置或依赖本机 Everything 安装 |

---

## 📥 安装

### 前置条件

- 已安装并运行 **DeepSeek Harness**
- 本机已安装 **Everything**（用于建立文件索引；es.exe 命令行工具随插件打包）

### 安装（本地 / 源码方式）

在 DSH 环境（或已配置 `DSH_HOME`）中运行：

```bash
dsh plugin --profile web add <本插件包路径>
```

例如（Windows）：

```powershell
dsh plugin --profile web add <本插件包路径>
```

> `link:` 会把插件链接为依赖；`dsh plugin add` 会应用 `cordis.patch.yml` 把插件行插入 web 插件表。

### 安装（发布到 npm / Git 后）

```bash
dsh plugin --profile web add dsh-everything-search
# 或
dsh plugin --profile web add github:yourname/dsh-everything-search
```

### 生效

安装完成后**重启 DeepSeek Harness**，输入框工具栏出现放大镜 🔍 按钮即生效。之后**刷新浏览器，插件始终保持**（正式 web 打包插件，自动加载）。

### 卸载

```bash
dsh plugin --profile web rm dsh-everything-search
```

---

## 🖥 使用

1. 点击输入框工具栏的 **放大镜 🔍** 按钮
2. 输入关键词（支持 Everything 语法），回车或点「搜索」
3. 用「类型」「范围」筛选；勾选想要的文件/文件夹
4. 点「**加入上下文**」→ 选中的路径以 `@引用` 写入输入框，确认发送即可让模型读取

或直接在对话里让 Agent 调用 `everything_search` 工具帮你搜。

---

## ⚙️ 设置

设置 → 侧边栏「**Everything 搜索**」：

- **默认结果数量**：每次搜索最多返回条数（20 / 50 / 100 / 200）
- **默认类型**：打开面板时默认筛选（全部 / 文件夹 / 文件）
- **搜索引擎路径**：es.exe 路径（默认随插件打包位置，可修改）

设置保存在浏览器 localStorage，刷新后保留。

---

## ❓ FAQ

**为什么需要安装 Everything？**
插件用 Everything 的 `es.exe` 命令行工具搜索。Everything 需要先建立全盘索引（首次运行时会自动建）。es.exe 随插件打包，但索引服务（Everything 主程序）建议本机安装。

**可以纯离线使用吗？**
可以 —— es.exe 随插件打包在 `lib/es.exe`，无需联网下载；搜索走本机 Everything 索引。

**支持中文路径吗？**
支持。搜索采用 UTF-8 导出再读取，中文文件名/路径不乱码。

**新文件搜不到（Everything 索引陈旧）？**
这通常说明本机的 **Everything 服务**没安装/没运行 —— 没有服务就缺少 USN 日志监控，新文件不会自动进索引。
- 本插件已内置**自动检测 + 自愈**：启动时会自动安装服务并重建索引
- 也可在 **设置 → Everything 搜索** 里查看状态，异常时点「**一键修复**」
- 手动修复（需管理员）：
  ```powershell
  & "C:\Program Files (x86)\Everything\Everything.exe" -install-service
  & "C:\Program Files (x86)\Everything\Everything.exe" -reindex
  ```

**升级 DSH 大版本后，插件 UI 不见了？**
DSH 更新后，第三方插件通常需要**重新注册一次**才会重新加载（Host 还在，但客户端不再挂载）：
```powershell
dsh plugin --profile web add <本插件包路径或包名>
```
然后**完整重启 DSH** + **重启浏览器**即可恢复。
> 这是 DSH 版本升级的通用现象，不是插件坏了。若仍不恢复，可先执行 `pnpm install && pnpm build` 再重启。

---

## 🔧 本 fork 的改动（cacads，1.0.4 → 1.0.5）

> 本仓库是 [dbaks/dsh-everything-search](https://github.com/dbaks/dsh-everything-search) 的 fork，用于修复上游 1.0.3 在 **DSH 0.2.0-rc.2** 上的两个缺陷：**① UI 完全不出现（静默）**、**② 搜索面板贴在屏幕底部正中（没跟输入框对齐）**。宿主半端的 `everything_search` 工具两版都正常。

### 1.0.4 —— 客户端半端**静默不挂载**

**症状**：🔍 按钮与「Everything 搜索」设置页**一个都不出现，且没有任何报错**。

**根因**：客户端半端既没在 `package.json` 的 `dsh.client.inject` 里，也没在自己的 `exports.inject` 里声明 `slots`，于是浏览器侧会在 `@deepseek-ai/dsh-client-ui-slots` 之前 materialize；`apply()` 里 `ctx.get('slots')` 拿到 `undefined` 后**直接 return**。官方文档 `docs/subsystems/client-modules.md` 的原话：

> `inject` names package rows whose factories must arrive before this row materializes, while Cordis separately uses the same package edges to compose entries.

| 文件 | 1.0.3 | 1.0.4 |
| --- | --- | --- |
| `package.json` → `dsh.client.inject` | `[]` | `["@deepseek-ai/dsh-client-ui-slots", "@deepseek-ai/dsh-client-ui-conversation"]` |
| `lib/client.js` → 导出 `inject` | `[]` | `['slots']` |
| `lib/client.js` → 服务缺失分支 | `if (slots === undefined) return`（静默） | 同名判断 + `console.warn(...)`，**不再无声** |

### 1.0.5 —— 搜索面板**贴屏幕底部正中**

**症状**：按钮位置正确，但点开后搜索面板横在**屏幕底部正中**，没和输入框对齐。

**根因**：面板原先注册在 `shell.overlay`（全局浮层，需自己定位），靠 `document.querySelector('textarea')` 量输入框的 `left/width`；而 **0.2.0-rc.2 的输入框已不是 `<textarea>`，是 Lexical 的 `contenteditable`**（`ComposerContentEditable`）→ 量不到 → 走兜底样式 `left:50%; transform:translateX(-50%)` + `bottom:0` = 屏幕底部正中。

**修法（官方坐席，不再手量）**：面板改装到 **`conversation.input.dock`**——`@deepseek-ai/dsh-client-ui-conversation` 的类型契约原文：*"Full-width entries above the composer card."*（`kind: list`，owner `InputZone`）。同时删除 `measureComposer()` / `geom` 状态 / `modalStyle` 兜底 / 全屏 backdrop 与 `.evs-modal` 定位 CSS，改为普通 `.evs-dock` 卡片。

**可复跑的验证**（不需要浏览器、不联网）：

```bash
node tools/verify-client.mjs                                                    # 校验本仓库 lib/client.js
node tools/verify-client.mjs <profile>/node_modules/dsh-everything-search/lib/client.js
```

三条断言：① 导出 `inject` 必须含 `slots`；② `apply()` 必须注册 `conversation.input.left`（按钮）/ `conversation.input.dock`（面板）/ `settings.section`（设置页）三个座位；③ 服务缺失时必须 warn。1.0.3 实测 **1/3**（复现静默失败），1.0.4 / 1.0.5 实测 **3/3**。

---

## 📄 License

[MIT](LICENSE)
