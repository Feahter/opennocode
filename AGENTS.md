# OpenNoCode — Agent 指南

纯前端无代码系统（React 18 + TypeScript + Vite + zustand + sql.js）。
四关键词：**无代码 / 纯前端 / 极致性能 / agent 友好**。

本文件面向未来在此仓库工作的 agent，说明架构、命令与配置格式。

---

## 架构五层

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
                       │ 旁挂（本仓库 P2-11 新增）
┌──────────────────────▼──────────────────────────┐
│ Agent 层   src/schema/* + src/api/index.ts       │ JSON Schema + DSL + window.OpenNoCode
└─────────────────────────────────────────────────┘
```

**核心约定**

- React 是唯一渲染入口，zustand 是唯一状态源；agent 写数据走 `window.OpenNoCode`，写后 store 自动刷新，UI 即时更新。
- `src/core/storage.ts`、`src/stores/appStore.ts` 为共享底层，**不要直接修改**，只复用其导出函数。
- 领域类型全部在 `src/types/index.ts`（App / Field / View / AppRecord / StateMachine / Role / Template…）。

---

## 开发命令

```bash
npm install       # 安装依赖
npm run dev       # 启动开发服务器（vite，端口 3000）
npm run build     # 生产构建（vite build → dist/）
npm run test      # 类型检查（tsc --noEmit，全量零错误）
npx tsc --noEmit  # 同 test，快速类型校验
```

> 纯前端、零后端：数据存于浏览器 localStorage（sql.js wasm 本地 SQLite），断网可用。

---

## 配置格式

### App（JSON，完整形态，与 `types/index.ts` 一一对应）

```json
{
  "id": "a1",
  "name": "客户管理",
  "type": "data",
  "description": "客户信息",
  "fields": ["f1", "f2"],
  "views": [{ "id": "v1", "type": "table", "name": "默认表格", "config": {} }],
  "state_machine": "sm1",
  "created_at": 1700000000000,
  "updated_at": 1700000000000
}
```

### Field

```json
{
  "id": "f1",
  "name": "amount",
  "type": "number",
  "meta": { "label": "金额", "required": true, "min": 0 },
  "permissions": [],
  "created_at": 1700000000000,
  "updated_at": 1700000000000
}
```

字段类型（12 种）：`text | number | select | multi_select | date | datetime | file | image | reference | formula | auto_id | checkbox`。

### View

```json
{ "id": "v1", "type": "table", "name": "默认表格", "config": {} }
```

视图类型：`table | list | kanban | form`。

### Agent 配置（省略 id/时间戳，自动补全）

`createApp` / `parseAppConfig` 接受省略 id、时间戳、views 的简化配置：

```json
{
  "name": "客户管理",
  "type": "data",
  "description": "客户信息",
  "fields": [
    { "name": "name", "type": "text", "label": "姓名" },
    { "name": "amount", "type": "number", "label": "金额", "meta": { "required": true } }
  ]
}
```

### DSL（文本格式，`parseDsl` / `serializeDsl`）

```text
app "客户管理" {
  description "客户信息管理";
  field name:text;
  field amount:number label "金额";
}
```

---

## 常用 API 示例（window.OpenNoCode）

页面加载后 API 已就绪（`main.tsx` 在存储初始化后挂载），agent 可直接调用：

```js
// 0. 确保就绪（幂等）
await window.OpenNoCode.init();

// 1. 校验配置（zod 原生，非法返回结构化错误 error.issues）
const check = window.OpenNoCode.parseAppConfig({ name: "x", type: "data" });
if (check.success) { /* check.data 为补全后的配置 */ }

// 2. 创建应用（可内嵌字段，一并落库；非法配置抛 ZodError）
const app = window.OpenNoCode.createApp({
  name: "客户管理",
  fields: [
    { name: "name", type: "text", label: "姓名" },
    { name: "amount", type: "number", label: "金额" },
  ],
});

// 3. 读写数据（写后 UI 自动刷新）
window.OpenNoCode.createRecord(app.id, { name: "张三", amount: 100 });
const records = window.OpenNoCode.queryRecords(app.id);

// 4. 查询 / 导入导出
window.OpenNoCode.listApps();
window.OpenNoCode.listFields();
const schema = window.OpenNoCode.exportSchema();   // JSON 字符串
window.OpenNoCode.importSchema(schema);            // 覆盖式导入

// 5. DSL 解析 / 序列化
const { apps, fields } = window.OpenNoCode.parseDsl('app "x" { field name:text; }');
const dslText = window.OpenNoCode.serializeDsl(apps, fields);
```

**错误处理约定**：配置非法时 `createApp` / `createField` / `parseDsl` 抛出 zod `ZodError`（`error.issues` 为结构化问题列表）；`parseAppConfig` 用 `safeParse` 不抛异常，返回 `{ success, data | error }`。

---

## 目录速览

```
src/
├── main.tsx          入口：初始化存储 → 挂载 window.OpenNoCode → 渲染
├── App.tsx           根组件（store.init 在此触发）
├── types/index.ts    全部领域类型（唯一类型源头）
├── core/storage.ts   sql.js 存储引擎（勿改）
├── stores/appStore.ts zustand 状态源（勿改）
├── schema/           JSON Schema（zod）+ DSL（P2-11 新增）
├── api/index.ts      window.OpenNoCode（P2-11 新增）
├── components/       视图组件
└── utils/            工具函数
```
