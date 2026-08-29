# OpenNoCode 改造方案

> 基于四关键词：无代码 / 纯前端 / 极致性能 / agent 友好
> 项目规模 1578 行，改造周期 1-2 天，底线：纯前端 + 本地化 + 离线可用

---

## 一、架构改造决策

### 1.1 现状问题诊断（实测代码，超出任务描述的部分已标注 ⚠️）

| # | 问题 | 严重度 | 证据 |
|---|------|--------|------|
| A | **运行时必崩**：`main.tsx` 里 `new App()` 把函数组件当 class 实例化，再调 `app.render()` | 🔴 致命 | `src/main.tsx:13` `const app = new App()` |
| B | **initStorage 双重调用**：`main.tsx` 调一次 + `App.tsx` 的 `useEffect(init)` 又调一次 | 🔴 | main.tsx:8 / App.tsx:20 |
| C | **双架构割裂**：`core/state.js`(全局单例) + `ui/render.js`(模板字符串 innerHTML) 与 zustand/React 并存，且 render.js 依赖 `onclick="selectApp()"` 全局函数（实际不存在） | 🔴 | state.js / render.js 从未被 React 树引用 |
| D | **sql.js 从 CDN 加载**，断网即挂，违反离线底线 | 🔴 | `storage.ts:13` `https://sql.js.org/dist/${file}` |
| E | **SQL 注入**：`getRecords` 用 `${appId}` 字符串拼接 | 🟠 | `storage.ts:221` |
| F | **saveToLocal 全量导出 + 栈溢出隐患**：每次写操作 `db.export()` + `String.fromCharCode(...data)`，大 Uint8Array 的 spread 会 RangeError | 🟠 | `storage.ts:111-112` |
| G | **eval() 公式引擎**：`helpers.js:81` 用 `eval(expr)`，mathjs 已引入未用；agent 注入风险 | 🟠 | helpers.js:75-85 |
| H | **类型未打通**：storage.ts 全 `any`，types/index.ts 定义的 12 字段类型零引用 | 🟡 | storage.ts 全文件 |
| I | **核心三视图占位**：`components/index.tsx` 全是 "To be implemented"，App.tsx 里还内联遮蔽了一份 | 🟡 | components/index.tsx:1-11 |
| J | **版本不一致**：`index.js` VERSION=0.4.0 vs package.json 0.1.0；`main.tsx` 与 `index.js` 双入口混乱 | 🟡 | index.js:7 |
| K | **echarts 全量引入**，无懒加载，bundle 无 code-split | 🟡 | package.json echarts + echarts-for-react |
| L | **无 agent 接口**：无 JSON Schema / DSL / API 层，配置不可程序化读写 | 🟡 | 全项目 |

### 1.2 目标架构

```
┌─────────────────────────────────────────────────┐
│  UI 层 (React 组件树，唯一渲染入口)                │
│  components/{apps, fields, data, common}/        │
└──────────────────────┬──────────────────────────┘
                       │ 只读订阅 + dispatch
┌──────────────────────▼──────────────────────────┐
│  Store 层 (zustand 单一状态源)                    │
│  stores/appStore.ts                              │
└──────────────────────┬──────────────────────────┘
                       │ 调用
┌──────────────────────▼──────────────────────────┐
│  Engine 层 (纯函数，UI 无关，可被 agent 直接调用)   │
│  core/{formula, permission, statemachine}.ts     │
└──────────────────────┬──────────────────────────┘
                       │ 读写
┌──────────────────────▼──────────────────────────┐
│  Storage 层 (sql.js 本地 wasm + 参数化查询)        │
│  core/storage.ts + core/query.ts                 │
└──────────────────────┬──────────────────────────┘
                       │ 旁挂
┌──────────────────────▼──────────────────────────┐
│  Agent 层 (JSON Schema + DSL + window.OpenNoCode) │
│  schema/*.ts + api/index.ts                      │
└─────────────────────────────────────────────────┘
```

**核心决策：**
1. **单一渲染**：删除 `ui/render.js`、`core/state.js`、`src/index.js`（旧架构残留），React 是唯一渲染入口，zustand 是唯一状态源。
2. **引擎纯函数化**：公式/权限/状态机抽成纯函数引擎，不依赖 React/UI，`window.OpenNoCode` API 直接复用它们 —— 这是"agent 友好"的根基。
3. **Storage 收敛**：`storage.ts` 只做「wasm 初始化 + 参数化 SQL + 持久化」，查询/过滤/排序拆到 `query.ts`。
4. **持久化降频**：saveToLocal 由「每次写立即全量导出」改为 debounce + 批量导出 + 分块 btoa。
5. **本地化**：wasm 通过 Vite `?url` 导入打进 bundle 或 copy 到 public，彻底去 CDN。

### 1.3 目标目录结构

```
src/
├── main.tsx              # 唯一入口
├── App.tsx               # 布局 + 视图切换
├── types/index.ts        # 领域类型（补齐，供全链路复用）
├── schema/               # ← 新增：agent 友好的 Schema/DSL
│   ├── json-schema.ts
│   └── dsl.ts
├── core/
│   ├── storage.ts        # sql.js 封装（本地 wasm + 参数化）
│   ├── query.ts          # ← 新增：过滤/排序/分页
│   ├── formula.ts        # ← 新增：公式引擎（mathjs）
│   ├── permission.ts     # ← 新增：权限引擎
│   └── statemachine.ts   # ← 新增：状态机引擎
├── stores/appStore.ts    # zustand 单一状态源
├── api/index.ts          # ← 新增：window.OpenNoCode
├── components/
│   ├── apps/             # 应用管理视图
│   ├── fields/           # 字段管理视图
│   ├── data/             # 表格 + 看板视图
│   └── common/           # Modal 等
└── utils/helpers.ts      # JS → TS
删除：core/state.js、ui/render.js、src/index.js、components/index.tsx(占位)
```

---

## 二、按模块拆分的改造任务清单

> 每个任务标注【并行组】，同组可交给不同 pi agent 并发；不同组按依赖顺序。

### P0 — 地基（串行，阻塞一切）

---

#### 任务 P0-1：修复运行时崩溃 + 统一入口

- **目标**：让应用真正能启动渲染，消除 `new App()` 崩溃与 initStorage 双重调用。
- **改动文件**：
  - `src/main.tsx`（重写）：`createRoot(root).render(<App/>)`，不在 main 里调 initStorage
  - `src/App.tsx`：删除 `useEffect` 里重复 init，init 只发生在 store 层；删除内联遮蔽的 `AppsView/FieldsView/DataView` 三个 const，统一从 components 引入
- **验收标准**：
  - `npm run dev` 打开无控制台报错（无 "App is not a constructor"）
  - 页面渲染出侧边栏「应用管理 / 字段管理」+ 主内容区
  - 断网状态下（DevTools Offline）仍能正常加载出界面
- **依赖**：无

---

#### 任务 P0-2：sql.js WASM 本地化

- **目标**：彻底移除 CDN 依赖，实现离线可用底线。
- **改动文件**：
  - `src/core/storage.ts`：`locateFile` 改为 `import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'`（Vite 会打包 wasm）
  - `vite.config.ts`：确保 `build.assetsInlineLimit` 或 `publicDir` 配置 wasm 拷贝正确
- **验收标准**：
  - `grep -r "sql.js.org" src/` 无结果
  - `npm run build && npm run preview` 断网打开，`initStorage()` 成功，localStorage 出现 `opennocode_db`
  - build 产物里 wasm 文件存在且相对路径引用
- **依赖**：无（与 P0-1 可并行，但同改 storage.ts，建议 P0-2 在 P0-1 之后做）

---

#### 任务 P0-3：清理旧架构死代码，统一 zustand

- **目标**：消灭双渲染/双状态源，确立 zustand 为唯一状态源。
- **改动文件**：
  - 删除 `src/core/state.js`、`src/ui/render.js`、`src/index.js`
  - 删除 `src/components/index.tsx` 的占位导出（占位内容，待 P1 重写）
  - `src/stores/appStore.ts`：补上 state.js 里已有的能力（updateApp/updateField/回收站 restore/permanentDelete/状态机/角色），迁移到 zustand
- **验收标准**：
  - `grep -r "core/state" src/` 与 `grep -r "ui/render" src/` 无引用
  - `npm run build` 通过（无 import 残留报错）
  - `tests/state.test.js` 若引用旧 State，同步改为测 zustand store 或标记 skip
- **依赖**：P0-1

---

#### 任务 P0-4：storage 类型化 + SQL 注入修复 + 持久化防栈溢出

- **目标**：打通 TS 类型，消除注入与性能隐患。
- **改动文件**：
  - `src/core/storage.ts`：
    - `getRecords` 改为参数化查询 `WHERE app_id = ?`
    - 所有函数签名从 `any` 改为 `Field/App/Record` 等具体类型
    - `saveToLocal` 改为分块 btoa（遍历 Uint8Array 分片转换），并加 debounce 合并连续写
  - `src/types/index.ts`：补充 `Record`、查询结果类型
- **验收标准**：
  - `npx tsc --noEmit` 零错误
  - 批量插入 1000 条记录不抛 `RangeError: Maximum call stack size exceeded`
  - `getRecords` 对含 `' OR '1'='1` 的 appId 不返回额外行（注入已修）
- **依赖**：P0-2（同文件，串行）

---

### P1 — 核心功能（P0 完成后可并行）

> 【并行组 A】：P1-5、P1-6、P1-7、P1-8 互相独立；P1-9、P1-10 依赖引擎文件但也可并行。

---

#### 任务 P1-5：应用管理视图

- **目标**：应用列表/新建/删除/选择，完整替换占位。
- **改动文件**：`src/components/apps/AppsView.tsx`（新建）、`src/stores/appStore.ts`（补 updateApp）
- **验收标准**：
  - 能创建应用（名称+描述）、列表展示、点击进入数据视图、删除带确认
  - 刷新后应用仍在（localStorage 持久化生效）
- **依赖**：P0-3

---

#### 任务 P1-6：字段管理视图（12 类型完整）

- **目标**：字段 CRUD + 12 种类型完整配置面板。
- **改动文件**：`src/components/fields/FieldsView.tsx` + `FieldEditor.tsx`（新建）、`src/types/index.ts`（补齐 FieldMeta 校验）
- **验收标准**：
  - 12 种类型（text/number/select/multi_select/date/datetime/file/image/reference/formula/auto_id/checkbox）均可创建，各自的 meta 配置项（options/prefix/min/max/target_app 等）可编辑
  - 字段持久化到 sqlite，刷新后仍在
- **依赖**：P0-3

---

#### 任务 P1-7：数据表格视图 + CRUD

- **目标**：表格视图展示记录、行内编辑、增删、搜索/过滤。
- **改动文件**：`src/components/data/TableView.tsx`（新建）、`src/core/query.ts`（新建：过滤/排序）
- **验收标准**：
  - 记录 CRUD 全链路可用，单元格编辑即保存
  - 搜索框按字段名过滤，性能上 1000 行无明显卡顿
- **依赖**：P0-3、P1-6（字段决定表格列）

---

#### 任务 P1-8：看板视图 + 拖拽 + 状态机

- **目标**：看板视图 + dnd-kit 拖拽换状态。
- **改动文件**：`src/components/data/KanbanView.tsx`（新建）、`src/core/statemachine.ts`（新建）
- **验收标准**：
  - 看板按状态分列，卡片可拖拽跨列，落列后 record.state 更新并持久化
  - 状态机校验非法迁移（如已完成→待处理被拦截并提示）
- **依赖**：P0-3、P1-6

---

#### 任务 P1-9：公式引擎（mathjs 替换 eval）+ 模板引擎

- **目标**：安全公式计算 + 模板渲染（tiptap 富文本）。
- **改动文件**：`src/core/formula.ts`（新建）、`src/core/template.ts`（新建）、删除 `src/utils/helpers.js` 里的 `calculateFormula`
- **验收标准**：
  - 公式字段用 mathjs 求值，`{field}` 引用替换后计算，非法表达式返回 error 而非抛异常
  - 全项目 `grep -r "eval(" src/` 无残留（除 mathjs 内部）
  - 模板可插入字段占位符并渲染输出
- **依赖**：无强依赖，可先行
- ⚠️ 安全：mathjs 默认无 `import/createUnit` 等危险函数，但需禁用 `evaluate` 的符号注入（white-list 字段名）

---

#### 任务 P1-10：权限系统 + 回收站 + 导入/导出

- **目标**：admin/editor/viewer 三级权限、软删除回收站、schema+数据导入导出。
- **改动文件**：`src/core/permission.ts`（新建）、`src/stores/appStore.ts`（回收站逻辑）、`src/core/storage.ts`（导出/导入用参数化）
- **验收标准**：
  - viewer 只读、editor 无删除、admin 全权限，切换角色后 UI 按钮状态随之变化
  - 删除记录进回收站可恢复/彻底删除
  - 导出 JSON → 清空 → 导入 JSON 后数据完整还原
- **依赖**：P0-4

---

### P2 — agent 友好 + 工程化（P1 后）

---

#### 任务 P2-11：JSON Schema + DSL + API 层

- **目标**：让 agent 能程序化读写配置（agent 友好的核心交付）。
- **改动文件**：
  - `src/schema/json-schema.ts`（新建）：App/Field/View 的 JSON Schema（可用 zod 生成）
  - `src/schema/dsl.ts`（新建）：最小 DSL（如 `app "订单" { field name:text; }` 的解析/序列化）
  - `src/api/index.ts`（新建）：暴露 `window.OpenNoCode = { listApps, createApp, createField, createRecord, query, exportSchema, importSchema, ... }`
  - `src/main.tsx`：挂载 API
- **验收标准**：
  - 浏览器控制台 `await window.OpenNoCode.listApps()` 返回应用数组
  - `window.OpenNoCode.createApp({name:'x'})` 后 React UI 同步刷新（同一 store）
  - JSON Schema 能 `zod.parse` 校验一段合法配置，非法配置报结构化错误
- **依赖**：P1-5/P1-6/P1-7

---

#### 任务 P2-12：echarts 懒加载 + bundle 体积优化

- **目标**：极致性能 —— 首屏体积最小化。
- **改动文件**：
  - 移除 `echarts-for-react`，图表改为 `import('echarts/core')` + 按需注册（Bar/Line/Pie + Grid/Tooltip/Legend）
  - `vite.config.ts`：`manualChunks` 拆分 vendor，echarts/mathjs/sql.js 独立 chunk
  - 图表组件 `React.lazy` 加载
- **验收标准**：
  - `npm run build` 后 echarts 代码不在首屏主 chunk 中
  - 首屏 JS gzip 体积下降（记录优化前后 `du -h dist/assets/*.js`）
  - 打开页面不加载图表功能时，无 echarts 网络请求
- **依赖**：P1 完成

---

#### 任务 P2-13：测试补齐 + 文档完备 + CI

- **目标**：可维护性 + agent 可读文档。
- **改动文件**：
  - `tests/`（补 query/formula/permission/statemachine 单测）
  - `README.md`（架构图 + agent 使用指南 + API 文档）
  - `docs/nocode-system-design.md`（补齐，当前缺失）
  - `.github/workflows/ci.yml`（新建：build + test）
- **验收标准**：
  - `npm test`（vitest）全绿
  - README 含 `window.OpenNoCode` API 使用示例
  - CI 在 push 时跑 `tsc --noEmit` + `vitest` + `vite build`
- **依赖**：全部 P1

---

## 三、优先级排序

| 级别 | 任务 | 理由 |
|------|------|------|
| **P0** | P0-1 修崩溃、P0-2 本地化、P0-3 清死代码、P0-4 类型+注入+性能 | 不修跑不起来 / 违反离线底线 / 后续一切的地基 |
| **P1** | P1-5~P1-10（六视图+引擎） | 从空壳变可用产品，核心价值 |
| **P2** | P2-11 agent 层、P2-12 懒加载、P2-13 测试文档 | 差异化亮点 + 工程化收尾 |

---

## 四、容易被忽略的风险点

1. **`String.fromCharCode(...data)` 栈溢出**（问题 F）：本地化 wasm 后数据量上来必现，务必分块 btoa。这是"性能"最易踩的坑，且测试难覆盖（需真实大库）。
2. **`index.html` 里的 `index.js` 双入口残留**：项目根有 `index.html` 与 `index.html.old`，旧版可能还引用已删的 `src/index.js`，删除死代码后要确认 Vite 入口正确指向 `main.tsx`。
3. **mathjs 公式的注入面**：mathjs `evaluate` 若不做符号白名单，`{field}` 里塞恶意字符串可能执行副作用（如 `unit` 转换、内存炸弹），必须 whitelist 字段名 + 关闭 symbol 注入。
4. **dnd-kit 拖拽与状态机的一致性**：拖拽落列是"视觉上换状态"，但必须走 `statemachine.transition()` 校验而非直接写 `record.state`，否则非法迁移会绕过状态机（UI 与引擎脱节）。
5. **删除 `state.js` 时 `tests/state.test.js` 会挂**：旧测试依赖被删单例，P0-3 必须同步处理测试，否则 `npm test` 从绿变红。
6. **localStorage 容量**：sqlite 全量 base64 存 localStorage 有 ~5MB 上限，导入大 schema/数据会 QuotaExceeded，需在 saveToLocal 捕获并提示（后续可换 IndexedDB/OPFS，本周期内至少优雅降级）。
7. **并发 pi agent 改同一文件冲突**：P1-6 字段视图、P1-7 表格、P1-8 看板都会碰 `stores/appStore.ts` 和 `types/index.ts`，调度时需锁定这两个文件为单写者，或先定接口契约再各自实现。
8. **echarts 按需引入漏注册组件**：`echarts/core` 方式若漏注册 Grid/Tooltip，图表静默白屏无报错，验收要真点开图表看渲染。

---

## 五、ROI 排序执行建议

> 按「单位时间价值」从高到低，建议执行顺序与并发编排：

1. **P0-1 修崩溃**（ROI 最高）：30 分钟让项目从"跑不起来"到"能跑"，是验收一切的前提。
2. **P0-2 本地化**（并列最高，可与 P0-1 并行）：守住"离线可用"底线，否则后续全部验收标准"断网可跑"不成立。
3. **P0-3 清死代码 + P0-4 storage 加固**（串行）：清理割裂、消除注入与栈溢出，为 P1 铺平类型基础。**P0-4 与 P0-3 可由两个 agent 并行**（P0-3 动 store/tests，P0-4 动 storage/types）。
4. **P1 六任务并发冲刺**（价值密度最高的一波）：P0 完成后，P1-5/6/7/8/9/10 六个 agent 并发。**关键前置**：先由主 agent 冻结 `appStore.ts` + `types/index.ts` 的接口契约（一个 15 分钟的"契约锁定"步骤），再放行并发，避免风险点 7 的写冲突。
5. **P2-11 agent 层**（差异化 ROI 最高）：这是"替代 saleswork"之外 OpenNoCode 的独特卖点，建议 P1 数据链路一通就立刻做，不必等全部 P1 完成。
6. **P2-12 懒加载**：见效快（改 vite 配置 + 改 import），可在 P1 任一 agent 空闲时插空做。
7. **P2-13 测试文档**：收尾，可最后统一由一个 agent 补齐。

**执行窗口估算**：P0 串行约 0.5 天 → P1 并发约 0.5~1 天 → P2 收尾约 0.5 天，总计 1-2 天，符合约束。

**并发编排示意**：
```
P0-1 ──┬── P0-3 ──┬── P1-5/6/7/8/9/10 (6 agent 并发，需先锁契约) ──┬── P2-11
P0-2 ──┴── P0-4 ──┘                                                ├── P2-12
                                                                    └── P2-13
```
