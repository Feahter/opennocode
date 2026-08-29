# OpenNoCode

纯前端无代码系统 — 用配置搭建千变万化的数据系统，不写一行后端。

> 无代码 · 纯前端 · 极致性能 · agent 友好

脱胎于商业 CRM 的对象模型，但完全开源、本地化、离线可用，是 AI 时代可被 agent 直接驱动与扩展的数据平台。

---

## 为什么做

传统无代码平台（如销售类 CRM）是闭源、云端的黑盒——数据在别人服务器上，定制受限，AI 时代更难被 agent 集成。OpenNoCode 的答案是：

- **配置即应用**：应用、字段、视图、状态机全部是 JSON 元数据，UI 只是配置的编辑器
- **零服务端**：sql.js (SQLite WASM) 本地运行，数据存 localStorage，断网可用
- **agent 原生**：`window.OpenNoCode` API + JSON Schema + DSL，AI agent 可以直接建应用、读写数据

## 快速开始

```bash
npm install
npm run dev        # 开发模式 http://localhost:3000
npm run build      # 生产构建（纯静态产物，可任意托管）
npm run preview    # 预览构建产物
npm test           # 运行测试（vitest）
```

构建产物在 `dist/`，是纯静态文件——丢到任意静态服务器或直接 `file://` 打开即可用。

## 四关键词

| 关键词 | 落地 |
|---|---|
| **无代码** | 应用管理 / 字段管理 / 数据表格 / 看板 全部可视化操作；12 种字段类型（文本/数字/单选/多选/日期/时间/文件/图片/关联/公式/自动编号/复选） |
| **纯前端** | React 18 + TypeScript + Vite；sql.js WASM 本地打包（659KB 进产物）；数据持久化到 localStorage；零服务端依赖 |
| **极致性能** | 单一状态源（zustand 精准订阅）；表格虚拟滚动（1000+ 行流畅）；公式引擎 AST 安全校验 + 编译缓存；manualChunks 拆包，首屏 gzip < 25KB |
| **agent 友好** | `window.OpenNoCode` API（12 方法）；zod JSON Schema 校验；最小 DSL 解析/序列化；`AGENTS.md` 给 agent 的项目说明 |

## 架构

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

## Agent 使用指南

浏览器打开应用后（或通过 `import { ... } from './src/api'`），`window.OpenNoCode` 已挂载：

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

// DSL 建应用：一行定义应用 + 字段
window.OpenNoCode.parseDsl('app "订单" { field amount:number; field status:select; }');

// 导入导出（备份/迁移/agent 交接）
const json = window.OpenNoCode.exportSchema();
window.OpenNoCode.importSchema(json);
```

完整 API 见 `src/api/index.ts`；配置格式见 `src/schema/json-schema.ts`。

## 功能

- ✅ 应用管理（创建/编辑/删除/进入数据视图）
- ✅ 字段系统（12 种类型，meta 完整配置）
- ✅ 数据表格（CRUD + 行内编辑 + 搜索 + 排序 + 虚拟滚动）
- ✅ 看板视图（dnd-kit 拖拽 + 状态机校验非法迁移）
- ✅ 公式字段（mathjs 安全求值，AST 白名单，无 eval）
- ✅ 模板引擎（{{占位符}} 渲染）
- ✅ 权限系统（admin/editor/viewer 三级 + 字段级）
- ✅ 回收站（软删除 + 恢复 + 彻底删除）
- ✅ 导入/导出（JSON schema 快照）
- ✅ agent 层（window.OpenNoCode + JSON Schema + DSL）
- 🚧 路线图：AI 自然语言建应用、Excel/CSV 导入、多租户/OEM

## 开发

```bash
npm run typecheck   # TS 类型检查
npm test            # 单元测试（22 用例：formula/query/permission/statemachine/dsl）
```

目录结构：

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

## License

MIT
