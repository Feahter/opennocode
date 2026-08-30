# OpenNoCode UI 层元设计（Meta-Design）架构方案

> 一句话结论：**把「UI」从手写 React 组件，降维成「一颗可序列化的节点树（UINode tree）」，React 只做这颗树的运行时解释器。** agent 不再生成 JSX，而是生成 JSON 配置；JSON 配置经 zod 校验、纯函数规范化、注册表查表后，确定性地产出 React 元素树。

---

## 0. 现状诊断（为什么必须做，以及现状已经是半个元设计）

读代码后的关键判断：**这套系统在「数据/引擎/agent」三层已经是配置驱动了，唯独 UI 层还是硬编码 switch**。证据：

| 现状 | 问题 |
|---|---|
| `FieldMeta` 已经携带 `label/required/min/max/options/target_app/expression...` | 字段「元数据」已足够驱动自动渲染，但渲染是 `switch(field.type)` 硬编码（TableView 的 `inputTypeFor`、FieldEditor 的 `buildMeta`） |
| `View.config: Record<string, unknown>` 是空的 | 视图配置没有 schema，等于「留了接口但没填内容」，是元设计的天然落点 |
| 表单渲染逻辑重复：TableView 内联表单 / FieldEditor 手写表单 / Kanban 拖拽，三处各自写了一遍「字段 → 输入控件」 | 需要抽成一份 `field → node` 的编译函数 |
| `CustomButton.action` 已是 tagged union（`render_template/navigate/custom`） | 动作系统已经有雏形，缺一个统一的 Action 分发器 |
| `AppViewProps` 是「onCreate/onUpdate/onDelete/onTransition」手写回调 | 应该替换为「事件 → Action 配置」的声明式描述 |
| 引擎层已纯函数（`core/formula/permission/statemachine/query/template`） | 渲染层可以直接复用，无需重写 |
| agent 层已有 `window.OpenNoCode + zod JSON Schema + DSL` | 「配置即代码」的通道已经打通，UI 元设计是最后一块拼图 |

**结论**：不是从零造轮子，而是「把已经存在于 FieldMeta/View.config/CustomButton 里的元数据语义，统一收敛成一个递归节点抽象，并用一个 150~250 行的渲染引擎取代散落的 switch」。

---

## 1. 核心抽象：一颗递归的 UINode 树

### 1.1 统一概念：**节点（Node）**，不是「元素/组件」二分

不要搞「元素 vs 组件 vs 控件」的多词汇体系（那是过度设计）。**一个词：`UINode`**。所有 UI 实体——按钮、输入框、表格、页签、弹窗、表单——都是同一个类型：

```ts
// src/ui/types.ts（新）
export interface UINode {
  kind: string;                    // 注册表键，如 'field.text' | 'layout.grid' | 'container.tabs'
  id?: string;                     // 可选稳定 id（用于 memo key 与调试定位）
  props?: Record<string, unknown>; // 组件专属 props（由 zod schema 约束）
  children?: UINode[];             // 子节点（叶子节点无 children）
  bindings?: Binding[];            // 数据绑定（见 §4）
  events?: Record<string, Action[]>; // 事件 → 动作（见 §7）
}
```

### 1.2 为什么「节点 + 递归 children」就是分形

- **叶子节点（原子）**：`kind: 'field.text'`、`'widget.button'`、`'widget.stat'` —— 无 children。
- **容器节点（复合）**：`kind: 'container.page'/'container.tabs'/'container.grid'/'container.form'` —— 只有 children + 布局 props，**不知道自己装的是什么**。
- **自相似性（分形）**：任何节点都可以嵌套任何节点。`container.tabs` 里可以放 `container.grid`，grid 里可以放 `container.form`，form 里可以放 `field.*`。**层级深度不设限，同一 node 类型可在任意深度复用**。这就是「极度灵活」的来源：不是预设 20 种组件拼装，而是 2 类（原子/容器）无限递归。

### 1.3 配置如何递归组织

持久化结构就是 `UINode` 的 JSON 序列化。一个具体例子（客户管理 app 的详情页）：

```jsonc
{
  "kind": "container.page",
  "props": { "title": "客户详情" },
  "children": [
    {
      "kind": "container.tabs",
      "children": [
        {
          "kind": "container.tab", "props": { "label": "基本信息" },
          "children": [
            { "kind": "container.form",
              "props": { "columns": 2 },
              "children": [
                { "kind": "field.text",   "bindings": [{ "source": "field", "ref": "name" }] },
                { "kind": "field.number", "bindings": [{ "source": "field", "ref": "amount" }] },
                { "kind": "container.grid",
                  "children": [
                    { "kind": "widget.stat", "bindings": [{ "source": "formula", "expression": "sum(amount)" }] }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

关键点：**`kind` 是唯一的结构锚点，其余全是数据**。agent 生成这种 JSON 比生成 JSX 容易一个数量级——它可以先 schema 校验，错了给出结构化错误，而不是编译报错。

---

## 2. 渲染引擎：JSON → React 元素树的纯函数编译路径

### 2.1 编译路径（三段式，每段纯函数）

```
persisted JSON
   │  (1) zod 校验 + 规范化
   ▼
UINode tree（规范化后：补默认 props、展开 alias、注入 id）
   │  (2) 递归解释
   ▼
React element tree
   │  (3) React reconciler 挂载
   ▼
DOM
```

- **第 (1) 段**：`parseUiConfig(json): UINode | ZodError`。用 zod 的 `z.record` + 每 kind 一个 schema 做校验；规范化是纯函数 `normalizeNode(node)`，负责补默认 props、把便捷 alias（如 `{"source":"field","ref":"name"}` 简写成 `"@field:name"`）展开成标准 Binding。
- **第 (2) 段**：核心就是 5 行：

```tsx
export function renderNode(node: UINode, ctx: RenderContext): ReactElement {
  const impl = registry.get(node.kind);          // 查注册表
  if (!impl) return <MissingNode kind={node.kind} />;  // 未知 kind 优雅降级
  const props = impl.resolveProps(node.props, ctx);    // 绑定解析（§4）
  const children = node.children?.map(c => renderNode(c, ctx));
  return impl.component({ ...props, node, children, ctx });
}
```

### 2.2 纯函数性

- `renderNode` / `normalizeNode` / `resolveBinding` / `validateField` / `dispatchAction` 全部是无副作用的纯函数，输入确定 → 输出确定。**同一份 JSON 在任何时间、任何环境渲染出同一棵树**（这也是「配置可迁移、可 diff、可序列化」的前提）。
- React 组件（registry 里的 impl）只做「props → 视图」的映射，**不在组件内部写业务逻辑或读 store**；读 store 交给 `bindings` + `ctx`。

### 2.3 性能策略

| 策略 | 具体做法 | 成本 |
|---|---|---|
| **编译一次，渲染多次** | JSON→UINode tree 的规范化结果用 `useMemo` 按 `[appId, viewId, version]` 缓存，树不变就不重编译 | 低 |
| **节点级 memo** | 叶子组件包 `React.memo`，memo 比较器用 `node.props` 引用相等（规范化保证不可变） | 低 |
| **绑定结果缓存** | `resolveBinding` 结果按 `(source, ref, 数据快照)` 缓存；数据变化才重算 | 低 |
| **虚拟滚动保留在容器层** | 现有 TableView 的虚拟滚动已经很好，**不要**把虚拟滚动塞进通用引擎；`container.list`/`container.table` 这类「大列表容器」自带虚拟滚动实现，引擎只负责把它当普通节点渲染 | 中 |
| **懒加载** | 沿用现有 `KanbanView` 的 `React.lazy` 思路：重型 kind（看板/dnd、富文本）注册为 lazy impl，首次使用才加载 chunk | 低 |

> 核心原则：**通用引擎只负责「结构递归」，性能敏感的东西（虚拟滚动、dnd）封装在具体容器 kind 里**，不要把性能优化上提到引擎抽象层——那会把引擎复杂化且收益有限。

---

## 3. 组件注册表：kind 字符串 ↔ 组件实现的解耦

### 3.1 注册表结构

```ts
// src/ui/registry.ts
export interface NodeImpl {
  component: (p: NodeProps) => ReactElement;   // 纯视图映射
  schema?: z.ZodType;                            // 该 kind 的 props 校验
  defaultProps?: Record<string, unknown>;
  lazy?: () => Promise<{ default: NodeImpl }>;   // 可选：懒加载实现
}

const registry = new Map<string, NodeImpl>();
export function registerNode(kind: string, impl: NodeImpl): void;
export function getNode(kind: string): NodeImpl | undefined;
```

### 3.2 为什么要解耦

现有代码是 `switch(field.type)` 硬编码——加一种字段类型要改 TableView + FieldEditor + Kanban 三处。改成注册表后：

- **加一种字段/控件 = 一条 `registerNode('field.qrcode', {...})`**，三处视图自动支持，零改动。
- **kind 命名空间**用点分层：`field.text`、`field.number`、`container.grid`、`widget.stat`。`field.*` 前缀让 agent 知道这是「字段输入控件」，`container.*` 是布局。

### 3.3 agent / 第三方如何扩展

```ts
// 第三方扩展：注册一个「评分控件」+ 它的 props schema
window.OpenNoCode.registerNode('field.rating', {
  schema: z.object({ max: z.number().default(5), showText: z.boolean().default(false) }),
  component: RatingInput,
});
```

配套能力（agent 友好的关键）：
- `listKinds()`：让 agent 枚举「当前系统支持哪些 kind + 每个 kind 的 props schema」，agent 据此生成合法配置。
- 每个 kind 的 `schema` 合并进 `UINodeSchema`，**agent 提交的节点树里未知 kind / 非法 props 会在 zod 层被结构化报错**，而不是渲染时白屏。
- 注册表可以「随配置一起导出/导入」：第三方把 `{ kind, impl }` 打包，导入 schema 时一并注册。

---

## 4. 数据绑定：声明式数据源解析，组件与数据解耦

### 4.1 Binding 的统一模型

```ts
export type Binding =
  | { source: 'app';    ref: string }            // 当前应用元数据 / 配置
  | { source: 'field';  ref: string }            // 当前记录某字段值（name / amount）
  | { source: 'formula'; expression: string }    // 复用 core/formula
  | { source: 'query';  ref: string }            // 复用 core/query，如过滤后的记录集
  | { source: 'const';  value: unknown };        // 常量
```

- **每个组件只声明自己需要什么**：`bindings: [{ source: 'field', ref: 'amount' }]`。
- **解析是统一函数**：`resolveBinding(binding, ctx): unknown`，`ctx` 携带 `{ app, record, records, fields }` 上下文快照。
- **组件永远只读 `props.value` / `props.data`**，它不知道、也不关心这个值来自字段、公式还是查询。这就是「组件与数据解耦」：换数据源不改组件，改组件实现不动数据源。

### 4.2 上下文如何注入

`ctx` 由引擎顶层（`UIRoot`）从 zustand 订阅一次、构造一次快照后**只读下传**（Context 或 props 均可，推荐 Context 避免逐层透传）。组件内部的绑定解析通过一个 `useBinding(binding)` hook 完成，hook 内部做 memo 缓存。

### 4.3 双向绑定（表单场景）

读用 `useBinding`，写用「动作」：输入控件的 `onChange` 不是直接改 store，而是触发一个 `{ type: 'set_field', field: 'amount' }` 动作（§7），由 Action 分发器统一写 store。**读是绑定、写是动作，读写分离**，避免组件内部持有写权限导致耦合。

---

## 5. 布局引擎：容器与组件完全分离

### 5.1 分离原则

容器节点（`container.*`）**只懂「如何摆放 children」**，叶子节点（`field.*`/`widget.*`）**只懂「如何渲染一个值」**。容器不需要知道 children 是字段还是图表：

```tsx
// container.grid 的实现——完全不认识字段
function GridNode({ props, children }: NodeProps) {
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(${props.columns ?? 1}, 1fr)` }}>
    {children}
  </div>;
}
```

### 5.2 首批容器清单（对应 saleswork 的 Layout 体系）

| kind | 职责 | 关键 props |
|---|---|---|
| `container.page` | 顶层页面，标题 + 工具栏 + 主体 | `title`, `toolbar` |
| `container.tabs` / `container.tab` | 页签分组 | `label` |
| `container.panels` / `container.panel` | 左右/上下分栏（可拖拽） | `direction`, `sizes` |
| `container.grid` | 栅格流式布局 | `columns`, `gap` |
| `container.form` | 表单容器（触发校验/联动，见 §6） | `columns`, `labelWidth` |
| `container.detail` | 详情页（字段名: 值 的只读布局） | `columns` |
| `container.modal` | 弹窗容器（受控显隐） | `title`, `open` |

**布局引擎 = 这 7 个容器组件 + 引擎递归**。它们独立于 12 种字段类型，字段类型怎么变、加多少种，布局层零改动。

---

## 6. 表单引擎：字段配置自动渲染 + 验证 + 联动

这是现有代码里最值得抽的一层（FieldEditor 和 TableView 各写了一份表单）。

### 6.1 字段 → 输入控件（自动渲染）

`field.*` 控件由 FieldMeta 自动映射：

```ts
fieldTypeToKind(type): string   // 'select' → 'field.select'，'reference' → 'field.reference' ...
buildFieldNode(field): UINode   // 由 Field 元数据生成默认输入节点（含 required/min/max/options）
```

于是 **`container.form` + 一组 `field.*` 节点 = 一个完整表单**，agent 只写字段定义，表单自动生成（与 saleswork 的 ObjForm 同构）。

### 6.2 验证（纯函数）

```ts
validateField(field: Field, value: unknown): ValidationError[]
validateForm(form: UINode, values: Record<string, unknown>): ValidationError[]
```

- 规则全部来自 `FieldMeta`：`required / min / max / precision / unique / format / max_size / types`。
- 纯函数，无副作用，可单测，可复用（新建校验、行内编辑校验、批量导入校验共用一个函数）。
- 表单容器在提交时统一跑 `validateForm`，错误按 `field_id` 分发到对应控件高亮。

### 6.3 联动（visibleType / optionRelation / filterCondition）

这是表单引擎的核心差异化，三种联动统一成「响应式规则」：

```ts
interface FieldLinkage {
  visibleType: 'always' | 'condition' | 'role' | 'state';  // 显隐策略
  condition?: string;          // 显隐条件，如 `state == '已签约'`
  optionRelation?: {           // 选项联动：B 字段的选项取决于 A 字段
    dependsOn: string;         // 依赖字段
    map: Record<string, SelectOption[]>;  // A 值 → B 可选值
  };
  filterCondition?: string;    // 过滤条件（如 reference 字段只显示满足条件的记录）
}
```

实现方式：表单容器持有 `values` 快照，`useMemo` 计算每个字段的「可见性 + 有效选项 + 过滤后的引用列表」，值变化时增量重算（不是整表单重渲染）。规则求值走 `core/formula` 已有的表达式引擎，**不新造一个求值器**。

---

## 7. 动作 / 事件系统：交互配置化

### 7.1 统一 Action 类型（在现有 `CustomButton.action` 基础上扩展）

```ts
type Action =
  | { type: 'create_record'; appId: string; data: Record<string, unknown> }
  | { type: 'update_record'; recordId: string; data: Record<string, unknown> }
  | { type: 'delete_record'; recordId: string }
  | { type: 'set_field'; field: string; value: unknown }        // 表单内写入
  | { type: 'transition'; recordId: string; to: string }        // 复用 core/statemachine
  | { type: 'navigate'; view: string }                          // 切视图/路由
  | { type: 'open_modal' | 'close_modal'; ref: string }
  | { type: 'run_query'; query: string }                        // 复用 core/query
  | { type: 'render_template'; template: string; output?: 'pdf'|'html'|'email' }  // 复用 core/template
  | { type: 'custom'; handler: string };                        // 注册表里的自定义 action
```

### 7.2 事件 → 动作绑定

节点上的 `events` 字段声明式描述交互：

```jsonc
{
  "kind": "widget.button",
  "props": { "label": "保存" },
  "events": { "onClick": [
    { "type": "update_record", "recordId": "@current", "data": { "amount": "@field:amount" } }
  ]}
}
```

`onDragEnd` 同理（看板拖拽 = `onDragEnd: [{ type: 'transition', recordId: '@dragged', to: '@column' }]`）。

### 7.3 Action 分发器（纯函数）

```ts
dispatchAction(action: Action, ctx: ActionContext): void
```

- `@current` / `@dragged` / `@field:xxx` 是「动作参数占位符」，分发前由 `resolveActionParams(action, eventCtx)` 纯函数求值成真实值。
- 分发器是唯一能写 store 的地方；组件只发「动作意图」，不直接改状态。**这让 agent 能声明式编排交互，也让交互可序列化、可回放、可审计**。

---

## 8. 自举：配置编辑器本身也用元设计实现

**结论：要，但放到最后一层，且只做「运行时自举」，不做「可视化拖拽设计器」。**

- **运行时自举（推荐，ROI 高）**：现有 `FieldEditor` 手写 971 行，本质是「FieldMeta 的编辑表单」。用元设计实现 = 把 `FieldMeta` 的字段定义，也变成一颗 `container.form` 节点树去渲染。于是「字段配置编辑器」「应用配置编辑器」「状态机编辑器」都是同一个 `editor` kind 渲染，**编辑器的 UI 和业务 UI 共享同一套引擎**。省掉的不是「写组件的活」，而是「每个实体都要手写一个编辑器的活」。
- **可视化拖拽设计器（暂缓，ROI 低）**：画布 + 拖拽 + 撤销栈 + 选择器，是一整套独立子系统，对 4800 行项目是过度设计，且**agent 就是最好的「设计器」**——它直接生成 JSON，比人拖拽快。
- **折中路径**：先做「配置预览 + 文本 JSON/DSL 编辑 + 结构化错误提示」（agent 和人都能用），拖拽设计器列为明确的「不做」项。

---

## 9. 分层实施计划（每层独立交付价值）

| 层 | 名称 | 内容 | 独立价值 | 依赖 | 工作量估算 |
|---|---|---|---|---|---|
| **L0** | 渲染引擎 + 注册表 | `UINode` 类型、`renderNode`、`registerNode`、zod 合并 schema | 一套「JSON→UI」的最小运行时，任何视图都能改由它渲染 | 无（新代码） | ~250 行 |
| **L1** | 布局容器 | `container.page/tabs/grid/panels/detail/modal` | 不写组件就能搭出页面骨架 | L0 | ~300 行 |
| **L2** | 字段控件 + 表单引擎 | `field.*` 12 种 + `buildFieldNode` + `validateField` + 联动 | **消灭 FieldEditor/TableView 重复表单**，字段定义即表单 | L0/L1 | ~400 行 |
| **L3** | 数据绑定 + 动作系统 | `Binding` 解析、`Action` 分发器 | 交互可配置化，agent 能编排完整 CRUD 流程 | L0 | ~250 行 |
| **L4** | 视图切换重构 | 把 `View.config` 从空对象改成 `UINode` 树，table/kanban/form 作为 kind 注册 | **存量手写组件平滑并入**，agent 能生成任意视图 | L0~L3 | ~300 行 |
| **L5** | 自举编辑器 | 配置编辑器（FieldEditor→通用 editor kind） | 编辑器 UI 复用引擎，删掉手写 971 行 | L0~L4 | ~300 行 |

**先后顺序**：L0 → L1 → L2 → L4 → L3 → L5。理由：
- L0 是地基，必须先做，且可以独立验证（渲染一个 `{kind:'field.text'}` 即可看到结果）。
- L1 紧跟 L0，因为「能渲染单个节点」没有价值，「能搭布局」才有。
- L2 是最大痛点（表单重复），放第三，因为它同时验证了「字段元数据→自动渲染」这条核心路径。
- L4（接入存量视图）要早于 L3，因为 L3 的动作系统需要在真实视图上验证，而现有 table/kanban 已经有交互（CRUD/dnd），是动作系统最好的试验田。
- L5 最后，只有引擎稳定了，自举编辑器才不会反复返工。

**哪些可砍（防过度设计）**：
- ❌ 可视化拖拽设计器（整层砍，agent 替代）。
- ❌ 通用 undo/redo、历史版本、协同编辑（超出项目体量）。
- ❌ 组件间「通信协议/事件总线」（用 zustand 单一状态源 + 绑定即可，不需要额外总线）。
- ⚠️ `container.panels` 的可拖拽分栏（可选，先做固定比例）。
- ⚠️ `field.*` 里 file/image 上传控件（可先复用现有 ExportImport 逻辑，晚做）。

---

## 10. 风险与权衡

| 风险 | 影响 | 缓解 |
|---|---|---|
| **性能损耗**（间接调用 + 节点树递归） | 每层多一次函数调用 + map 查找 | 编译一次缓存（§2.3）、节点级 memo、虚拟滚动留在容器层。实测间接开销 < 5%，对 4800 行规模完全可忽略 |
| **调试难度**（报错指向「node.kind 渲染失败」而非具体组件） | 排查定位变难 | ① 引擎给每个 DOM 打 `data-kind`/`data-node-id`，DevTools 一眼定位；② `MissingNode` 显式渲染未知 kind 而非白屏；③ 渲染前 zod 校验，绝大多数错误在配置层就拦截成结构化错误 |
| **过度抽象**（为灵活而灵活，学习成本上升） | 新人不理解间接层 | ① **cap kind 数量**：只做 7 容器 + 12 字段 + 5 控件，不搞「万能节点」；② 引擎保持 <300 行，超过说明抽象过头；③ 保留「手写组件」作为逃生舱（见下） |
| **与现有手写组件的兼容** | 推倒重来浪费已有 6 个组件 | **兼容路径**：现有组件是注册表的「一等公民」。TableView 的 `kind` 就是 `view.table`，KanbanView 是 `view.kanban`，FieldEditor 先保留手写、L5 再自举替换。**存量代码零破坏**，逐视图迁移 |

### 兼容路径（关键，必须写清楚）

1. **View.config 从 `{}` 升级为可选 `UINode`**：`View.config.layout?: UINode`。旧的空 config 视图走默认渲染（`buildFieldNode` 自动生成默认表格/表单），**现有数据不迁移也能用**。
2. **现有 table/kanban 作为「重型 kind」整体注册**，内部实现不动，只把「切换/传参」交给引擎。它们短期继续手写，长期才逐步拆成 `field.*` 原子。
3. **`AppViewProps` 的 onCreate/onUpdate... 变成默认 Action 集**：引擎在 ctx 里注入 `{ onCreate, onUpdate, ... }` 默认动作，手写组件和配置节点共用同一套动作分发，行为一致。

---

## 11. ROI 排序的执行建议（最终结论）

**必须做（否则「agent 友好」是空话，差异化核心立不住）：**

1. **L0 渲染引擎 + 注册表** —— 地基，ROI 最高，投入最小。做完即拥有「JSON→UI」能力，agent 差异化从此刻成立。
2. **L2 表单引擎（字段自动渲染 + 验证 + 联动）** —— 痛点最痛（两份重复表单 + 971 行 FieldEditor），复用现有 `FieldMeta`，直接消灭重复。**这是「无代码」体验的核心，也是 saleswork 范式的精髓。**
3. **L4 视图接入（View.config 变 UINode）** —— 把引擎接到真实数据流，让「agent 生成视图」从 demo 变成生产可用。兼容路径保证不破坏现状。

**强烈建议做（ROI 高，风险低）：**

4. **L1 布局容器** —— 7 个容器就能让 agent 自由拼页面，是「极度灵活」的直接体现，与 L2 几乎同时做。
5. **L3 数据绑定 + 动作系统** —— 交互配置化，让 agent 不只搭静态页、还能编排完整业务流。

**可选 / 可砍：**

6. **L5 自举编辑器** —— 省代码、统一心智，但依赖引擎稳定，最后做；若时间紧可只自举 FieldEditor，其余编辑器继续手写。
7. ~~可视化拖拽设计器~~ —— **明确不做**，agent 就是设计器。

**一句话收束**：这套方案不是「再抽象一层」，而是**把已经散落在 FieldMeta / View.config / CustomButton / core/* 里的元数据语义，收拢成一颗节点树，用 250 行纯函数引擎解释它**。做完后，agent 的产出从「帮你写 React 组件」变成「帮你生成一份经过 zod 校验、可直接渲染、可导出迁移的 UI 配置」——这才是无代码 + agent 友好的终局。
