<div align="center">

# OpenNoCode

**纯前端无代码数据系统 · No-Code Data Platform, 100% Frontend**

无代码 · 纯前端 · 极致性能 · Agent 友好
*No-Code · Pure Frontend · Extreme Performance · Agent-Friendly*

[![CI](https://img.shields.io/github/actions/workflow/status/Feahter/opennocode/ci.yml?branch=master)](https://github.com/Feahter/opennocode/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-19-blue)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8-purple)](https://vitejs.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-7-3178c6)](https://www.typescriptlang.org)

用配置搭建千变万化的数据系统，不写一行后端。
*Build any data system from configuration — zero backend code.*

</div>

---

## 📖 中文文档

### 这是什么

OpenNoCode 是一个纯前端、本地化的无代码数据平台。它脱胎于商业 CRM（Salesforce 式对象模型）的核心理念，但完全开源、离线可用、零服务端依赖——数据全部留在你的浏览器里。

它解决的问题：传统无代码平台（如销售类 CRM）是闭源、云端的黑盒，数据在别人服务器上，定制受限，AI 时代更难被 agent 集成。

**OpenNoCode 的答案：**
- **配置即应用**：应用、字段、视图、状态机全部是 JSON 元数据，UI 只是配置的编辑器
- **零服务端**：sql.js (SQLite WASM) 本地运行，数据存 localStorage，断网可用
- **Agent 原生**：`window.OpenNoCode` API + JSON Schema + DSL，AI agent 可以直接建应用、读写数据

### 快速开始

```bash
npm install
npm run dev        # 开发模式 http://localhost:3000
npm run build      # 生产构建（纯静态产物）
npm run preview    # 预览构建产物
npm test           # 单元测试（vitest，22 用例）
npm run typecheck  # TypeScript 类型检查
```

构建产物在 `dist/`，纯静态文件——丢到任意静态服务器即可用。

### 四关键词

| 关键词 | 落地 |
|---|---|
| **无代码** | 应用管理 / 字段管理 / 数据表格 / 看板 全部可视化操作；12 种字段类型 |
| **纯前端** | React + TypeScript + Vite；sql.js WASM 本地打包；数据存 localStorage；零服务端 |
| **极致性能** | zustand 精准订阅；表格虚拟滚动；公式引擎 AST 校验 + 编译缓存；manualChunks 拆包，主 chunk gzip < 25KB |
| **Agent 友好** | `window.OpenNoCode` API（12 方法）；zod JSON Schema；DSL 解析/序列化；`AGENTS.md` |

### 功能

- ✅ **应用管理**：创建 / 编辑 / 删除 / 进入数据视图
- ✅ **字段系统**：12 种类型（文本/数字/单选/多选/日期/时间/文件/图片/关联/公式/自动编号/复选），meta 完整配置
- ✅ **数据表格**：CRUD + 行内编辑 + 搜索 + 排序 + 虚拟滚动（1000+ 行流畅）
- ✅ **看板视图**：dnd-kit 拖拽 + 状态机校验非法迁移
- ✅ **公式字段**：mathjs 安全求值，AST 白名单，无 eval
- ✅ **模板引擎**：`{{占位符}}` 渲染
- ✅ **权限系统**：admin / editor / viewer 三级 + 字段级权限
- ✅ **回收站**：软删除 + 恢复 + 彻底删除
- ✅ **导入 / 导出**：JSON schema 快照（备份/迁移/agent 交接）
- ✅ **Agent 层**：`window.OpenNoCode` + JSON Schema + DSL
- 🚧 **路线图**：AI 自然语言建应用、Excel/CSV 导入、字段联动、审批流、多租户

### 架构

```
┌─────────────────────────────────────────────────┐
│ UI 层      src/components/                       │ React 组件树，唯一渲染入口
└──────────────────────┬──────────────────────────┘
                       │ 只读订阅 + dispatch
┌──────────────────────▼──────────────────────────┐
│ Store 层   src/stores/appStore.ts                │ zustand 单一状态源
└──────────────────────┬──────────────────────────┘
                       │ 调用
┌──────────────────────▼──────────────────────────┐
│ Engine 层  src/core/{formula,permission,...}.ts  │ 纯函数，UI 无关
└──────────────────────┬──────────────────────────┘
                       │ 读写
┌──────────────────────▼──────────────────────────┐
│ Storage 层 src/core/storage.ts                   │ sql.js 本地 wasm + 参数化 SQL
└──────────────────────┬──────────────────────────┘
                       │ 旁挂
┌──────────────────────▼──────────────────────────┐
│ Agent 层   src/schema/* + src/api/index.ts       │ JSON Schema + DSL + window.OpenNoCode
└─────────────────────────────────────────────────┘
```

### Agent 使用指南

浏览器打开应用后，`window.OpenNoCode` 已挂载：

```js
// 列出应用
await window.OpenNoCode.listApps();

// 创建应用（UI 自动刷新）
window.OpenNoCode.createApp({ name: '客户管理', type: 'data' });

// 创建字段
window.OpenNoCode.createField({ name: '客户名', type: 'text', label: '客户名', meta: { label: '客户名' } });

// 写数据
const app = window.OpenNoCode.listApps().at(-1);
window.OpenNoCode.createRecord(app.id, { 客户名: '张三' });

// 查询
window.OpenNoCode.queryRecords(app.id);

// DSL 一行建应用 + 字段
window.OpenNoCode.parseDsl('app "订单" { field amount:number; field status:select; }');

// 导入导出（备份/迁移/agent 交接）
const json = window.OpenNoCode.exportSchema();
window.OpenNoCode.importSchema(json);
```

完整 API 见 `src/api/index.ts`；配置格式见 `src/schema/json-schema.ts`。

### 开发

```
src/
├── main.tsx          # 唯一入口（初始化存储 + 挂载 API + 渲染）
├── App.tsx           # 布局 + 视图切换
├── types/            # 领域类型（App/Field/View/StateMachine/...）
├── core/             # 引擎层：storage / query / formula / permission / statemachine / recycle / template
├── stores/           # zustand 单一状态源
├── api/              # window.OpenNoCode（agent 接口）
├── schema/           # zod JSON Schema + DSL
└── components/       # apps / fields / data（表格+看板+导入导出）视图
```

### License

MIT

---

## 📖 English Documentation

### What is this?

OpenNoCode is a **pure-frontend, local-first no-code data platform**. It inherits the core idea of commercial CRMs (Salesforce-style object model) — but is completely open source, offline-capable, and has **zero server dependencies**. All your data stays in your browser.

**The problem it solves:** traditional no-code platforms (sales CRMs etc.) are closed-source, cloud-hosted black boxes — your data lives on their servers, customization is limited, and they're hard for AI agents to integrate with.

**OpenNoCode's answer:**
- **Configuration is the app** — apps, fields, views, state machines are all JSON metadata; the UI is just a configuration editor
- **Zero backend** — sql.js (SQLite WASM) runs locally, data persists in localStorage, works offline
- **Agent-native** — `window.OpenNoCode` API + JSON Schema + DSL let AI agents build apps and manage data programmatically

### Quick Start

```bash
npm install
npm run dev        # dev mode http://localhost:3000
npm run build      # production build (pure static output)
npm run preview    # preview the build
npm test           # unit tests (vitest, 22 cases)
npm run typecheck  # TypeScript type checking
```

The `dist/` output is pure static files — deploy to any static host.

### The Four Pillars

| Pillar | Implementation |
|---|---|
| **No-Code** | App management / field management / data table / kanban all visual; 12 field types |
| **Pure Frontend** | React + TypeScript + Vite; sql.js WASM bundled locally; localStorage persistence; zero server |
| **Extreme Performance** | zustand precise subscription; virtual-scroll table; formula AST validation + compile cache; manualChunks splitting, main chunk gzip < 25KB |
| **Agent-Friendly** | `window.OpenNoCode` API (12 methods); zod JSON Schema; DSL parse/serialize; `AGENTS.md` |

### Features

- ✅ **App Management** — create / edit / delete / enter data view
- ✅ **Field System** — 12 types (text/number/select/multi-select/date/datetime/file/image/reference/formula/auto-id/checkbox), full meta config
- ✅ **Data Table** — CRUD + inline edit + search + sort + virtual scroll (smooth with 1000+ rows)
- ✅ **Kanban View** — dnd-kit drag & drop + state-machine transition validation
- ✅ **Formula Fields** — safe mathjs evaluation, AST whitelist, no eval
- ✅ **Template Engine** — `{{placeholder}}` rendering
- ✅ **Permissions** — admin / editor / viewer roles + field-level permissions
- ✅ **Recycle Bin** — soft delete + restore + permanent delete
- ✅ **Import / Export** — JSON schema snapshot (backup / migration / agent handoff)
- ✅ **Agent Layer** — `window.OpenNoCode` + JSON Schema + DSL
- 🚧 **Roadmap** — AI natural-language app building, Excel/CSV import, field chaining, approval flows, multi-tenancy

### Architecture

```
┌─────────────────────────────────────────────────┐
│ UI Layer     src/components/                     │ React component tree, single render entry
└──────────────────────┬──────────────────────────┘
                       │ subscribe + dispatch
┌──────────────────────▼──────────────────────────┐
│ Store Layer  src/stores/appStore.ts              │ zustand single source of truth
└──────────────────────┬──────────────────────────┘
                       │ calls
┌──────────────────────▼──────────────────────────┐
│ Engine Layer src/core/{formula,permission,...}   │ pure functions, UI-agnostic
└──────────────────────┬──────────────────────────┘
                       │ read/write
┌──────────────────────▼──────────────────────────┐
│ Storage      src/core/storage.ts                 │ sql.js local wasm + parameterized SQL
└──────────────────────┬──────────────────────────┘
                       │ sidecar
┌──────────────────────▼──────────────────────────┐
│ Agent Layer  src/schema/* + src/api/index.ts     │ JSON Schema + DSL + window.OpenNoCode
└─────────────────────────────────────────────────┘
```

### Agent Usage

After opening the app in a browser, `window.OpenNoCode` is mounted:

```js
// List apps
await window.OpenNoCode.listApps();

// Create an app (UI auto-refreshes)
window.OpenNoCode.createApp({ name: 'Customer CRM', type: 'data' });

// Create a field
window.OpenNoCode.createField({ name: 'customerName', type: 'text', label: 'Customer Name', meta: { label: 'Customer Name' } });

// Write data
const app = window.OpenNoCode.listApps().at(-1);
window.OpenNoCode.createRecord(app.id, { customerName: 'Alice' });

// Query
window.OpenNoCode.queryRecords(app.id);

// DSL: define app + fields in one line
window.OpenNoCode.parseDsl('app "Orders" { field amount:number; field status:select; }');

// Export / import (backup / migration / agent handoff)
const json = window.OpenNoCode.exportSchema();
window.OpenNoCode.importSchema(json);
```

Full API: `src/api/index.ts` · Config schema: `src/schema/json-schema.ts`

### Development

```
src/
├── main.tsx          # entry (init storage + mount API + render)
├── App.tsx           # layout + view switching
├── types/            # domain types (App/Field/View/StateMachine/...)
├── core/             # engines: storage / query / formula / permission / statemachine / recycle / template
├── stores/           # zustand single source of truth
├── api/              # window.OpenNoCode (agent interface)
├── schema/           # zod JSON Schema + DSL
└── components/       # apps / fields / data (table+kanban+import-export) views
```

### License

MIT
