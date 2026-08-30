# OpenNoCode vs SalesWork 功能完成度对比

> 2026-08-29 | 参照对象：saleswork 家族（webapp/models/os/gaker/bi/message/admin/mini/login）
> 只看功能点，不纠结技术实现

## SalesWork 功能全景（跨全部子系统）

| # | 功能域 | 子功能 | SalesWork 位置 |
|---|--------|--------|----------------|
| 1 | 对象管理 | 动态列表（条件筛选）/ 详情 / 表单（配置驱动） | webapp/object |
| 2 | 字段系统 | 字段类型、验证规则、计算表达式 | models/object + webapp/object |
| 3 | 字段联动 | formValidator / rule / fieldEditable / visibleType / optionRelation / filterCondition | models/object |
| 4 | 布局系统 | Header / Tab / Detail / Personal / Tenant 布局 | models/object/Layout |
| 5 | 审批流程 | 审批列表 / 审批详情 / 工作流（节点/状态/审批人） | webapp/Approval + models/Workflow |
| 6 | 用户中心 | 用户模型（账号/状态/部门）、用户管理 | models/User |
| 7 | 权限管理 | 角色权限、页面级（MenuAuth）、操作级、动态更新、字段级 | models/Auth + webapp |
| 8 | 组织架构 | 部门层级、部门权限 | models/Department |
| 9 | 租户管理 | TenantInfo、租户配置、使用限制 | models/TenantInfo |
| 10 | 子对象 | SubDataChanger / SpecificSubDataChanger | models/object |
| 11 | 文件上传 | 文件管理 | webapp + mini |
| 12 | 多平台登录 | 钉钉 / 飞书 / 微信 / 账号密码 / 找回 | login |
| 13 | 移动端 | 对象管理 / 审批 / 上传 / 定位（Taro 多端） | mini |
| 14 | 消息通知 | 列表 / 分类 / 已读未读 / 实时推送 | message |
| 15 | BI 报表 | 仪表板 / 图表（柱/折线/饼）/ 实时更新 | bi |
| 16 | 外链管理 | 外链系统 | webapp/outlink |
| 17 | 支付模块 | 支付 | webapp/payment |
| 18 | 微前端平台 | 多应用集成 / 统一认证 / 全局状态 | admin + os |
| 19 | 组件库 | 自定义基础/业务组件库 | basecomponents/components |
| 20 | 富文本编辑 | TinyMCE / Syllepsis | webapp + gaker |
| 21 | 可视化编辑 | 拖拽式组件编辑 / 数字体验平台 | gaker-editor / gaker-dxp |
| 22 | 甘特图 | 甘特图组件 | gaker |
| 23 | 国际化 | locales 多语言 | os + admin |
| 24 | 地理位置 | 高德地图 | gaker + mini |

## OpenNoCode 现状

### ✅ 已实现（UI 可用）

| 功能 | 对应 saleswork | 完成度 |
|------|----------------|--------|
| 应用管理（列表/新建/删除/进入数据视图） | 对象列表 | 100% |
| 字段管理（12 类型完整配置编辑器） | 字段系统 | 100% |
| 数据表格（CRUD + 行内编辑 + 搜索 + 排序 + 虚拟滚动） | 对象列表/表单 | 100% |
| 看板视图（dnd 拖拽 + 状态机校验） | 布局/看板类视图 | 100% |
| 公式字段（mathjs 安全求值） | 计算表达式 | 100% |
| 导入/导出（JSON schema 快照） | —（saleswork 无对应） | 100% |
| Agent 层（window.OpenNoCode + Schema + DSL） | —（AI 时代新增） | 100% |

### ⚠️ 引擎有但 UI 未接入

| 功能 | 状态 | 缺口 |
|------|------|------|
| 权限系统 | core/permission.ts 纯函数引擎（admin/editor/viewer + 字段级） | 无角色管理 UI、无页面级权限、无动态权限 |
| 回收站 | core/recycle.ts 内存态引擎 | 无 UI 入口（删除直接走，未入 bin 展示） |
| 模板引擎 | core/template.ts（{{占位符}}） | 无模板编辑 UI |
| 关联字段 reference | 类型定义 + FieldEditor 展示 | 无关联选择器 UI、无关联记录展示 |
| 文件/图片字段 | 类型定义 | 无上传 UI、无文件展示 |
| 自定义按钮 | types 有定义 | 无实现 |

### ❌ 未实现

| 功能域 | 缺口 |
|--------|------|
| 对象详情页 | 只有表格行内编辑，无详情页 |
| 审批流程 | 状态机有，但无审批流（审批人/节点/审批列表） |
| 用户中心 / 登录 | 本地单用户，无账号体系 |
| 字段联动 | 无 visibleType / optionRelation / 级联过滤 UI |
| 布局系统 | 无 Header/Tab/Detail 布局配置 |
| 组织架构 / 部门 | 无 |
| 租户管理 | 无 |
| 子对象 | 无（reference 是唯一关联雏形） |
| 消息通知 | 无 |
| BI 报表 | 无（echarts 已移除） |
| 移动端 | 无 |
| 外链 / 支付 | 无 |
| 富文本编辑 | 无（tiptap 已移除） |
| 国际化 | 无（README 双语仅文档层） |
| 甘特图 / 地图 | 无 |

## 完成度结论

**对照 saleswork webapp 核心业务（对象管理域）**：约 **40%**
- 已覆盖：对象列表 / 配置驱动表单 / 字段系统 / 数据 CRUD / 看板
- 未覆盖：详情页 / 审批流 / 用户中心 / 布局系统 / 字段联动

**对照 saleswork 全系统（含平台层）**：约 **25%**
- saleswork 是 10+ 个子系统的 PSA 全家桶（登录/移动端/BI/消息/支付/微前端），OpenNoCode 定位是"单机版核心"，平台层功能本就不在目标内

## 建议的下一步（按 ROI）

1. **P0 补 UI 缺口**（引擎已就绪，成本最低）：权限 UI 接入、回收站 UI、reference 选择器、文件上传
2. **P1 详情页 + 字段联动**（对象管理闭环）：详情页（saleswork 对象管理三件套之一）、visibleType/optionRelation
3. **P2 审批流**（销售/CRM 类场景刚需）：在状态机之上加审批人/节点
4. **P3 差异化**：AI 自然语言建应用（DSL 已就绪）、Excel/CSV 导入——这是 saleswork 没有的 AI 时代能力
