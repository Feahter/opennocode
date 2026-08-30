// ============================================
// UI 元设计 — 演示页（体会实际效果）
// ============================================
// 一份纯 JSON 配置 → 渲染出带字段联动 + 验证的完整表单。
// 这就是"agent 生成配置而非 JSX"的实证：下面整份表单无一行组件代码。

import React from 'react';
import { UIRoot, buildFieldNode, validateForm, evaluateLinkage, registerBuiltins } from '../ui';
import type { UINode } from '../ui';

// 确保注册表已初始化（幂等）
registerBuiltins();

// ---------- 一份"客户登记"配置（纯 JSON，无组件代码） ----------
const customerFormConfig: UINode = {
  kind: 'container.page',
  props: { title: '客户登记（元设计演示）' },
  children: [
    {
      kind: 'container.form',
      props: { columns: 2, title: '基本信息' },
      children: [
        { kind: 'field.text', props: { name: 'name', label: '客户名称', required: true, placeholder: '请输入公司名' } },
        { kind: 'field.select', props: { name: 'level', label: '客户等级', options: [
          { label: '普通', value: 'normal' },
          { label: 'VIP', value: 'vip' },
          { label: '战略', value: 'strategic' },
        ] } },
        { kind: 'field.number', props: { name: 'amount', label: '合同金额', min: 0, placeholder: '元' } },
        { kind: 'field.date', props: { name: 'signDate', label: '签约日期' } },
        // 联动演示：仅当等级=战略 显示"专属顾问"
        {
          kind: 'field.text',
          props: {
            name: 'consultant', label: '专属顾问',
            linkage: { visibleType: 'condition', condition: "level == 'strategic'" },
          },
        },
        // 联动演示：客户类型决定选项
        {
          kind: 'field.select',
          props: {
            name: 'category', label: '客户类型',
            linkage: {
              visibleType: 'condition',
              condition: "level == 'vip' || level == 'strategic'",
              optionRelation: {
                dependsOn: 'level',
                map: {
                  vip: [
                    { label: '企业客户', value: 'enterprise' },
                    { label: '个人大客户', value: 'person' },
                  ],
                  strategic: [
                    { label: '集团客户', value: 'group' },
                    { label: '政府客户', value: 'gov' },
                  ],
                },
              },
            },
          },
        },
        { kind: 'field.checkbox', props: { name: 'active', label: '启用', checkLabel: '该客户启用中' } },
      ],
    },
  ],
};

// ---------- 由配置 + Field 元数据自动生成表单 ----------
const autoFields = [
  { name: 'title', type: 'text' as const, meta: { label: '标题', required: true } },
  { name: 'priority', type: 'select' as const, meta: { label: '优先级', options: [{ label: '高', value: 'high' }, { label: '低', value: 'low' }] } },
  { name: 'score', type: 'number' as const, meta: { label: '评分', min: 0, max: 100 } },
];
const autoFormConfig: UINode = {
  kind: 'container.page',
  props: { title: '自动生成表单（字段定义即表单）' },
  children: [
    {
      kind: 'container.form',
      props: { columns: 1, title: 'buildFieldNode 自动渲染' },
      children: autoFields.map((f) => buildFieldNode(f)),
    },
  ],
};

/** 演示控制器：持有表单值 + 验证错误，注入 ctx */
export function UIDemo() {
  const [values, setValues] = React.useState<Record<string, unknown>>({ level: 'vip' });
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [submitted, setSubmitted] = React.useState(false);

  const setValue = (field: string, value: unknown) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => {
      const next = { ...e };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = () => {
    // 校验两部分：配置表单（name 必填 + amount 数字）+ 自动表单（title 必填 + score 范围）
    const cfgErrs = validateForm(
      [
        { name: 'name', type: 'text' as const, meta: { label: '客户名称', required: true } },
        { name: 'amount', type: 'number' as const, meta: { label: '合同金额', min: 0 } },
      ],
      values
    );
    const autoErrs = validateForm(autoFields, values);
    setErrors({ ...cfgErrs, ...autoErrs });
    setSubmitted(true);
  };

  // 计算联动（当前值 → 每个字段的可见性/选项）
  const linkageOf = (name: string) => {
    const node = customerFormConfig.children?.[0].children?.find((c) => c.props?.name === name);
    const linkage = (node?.props as Record<string, unknown> | undefined)?.linkage;
    return evaluateLinkage(linkage as never, values);
  };
  const consultantVis = linkageOf('consultant');
  const categoryVis = linkageOf('category');
  const categoryOpts = categoryVis.options ?? [];

  // 注入 ctx：values + setValue + 联动结果
  const ctx = {
    values,
    setValue,
  };

  // 手动注入联动后的动态选项（演示联动效果）
  const linkedCustomerConfig: UINode = {
    ...customerFormConfig,
    children: [
      {
        ...customerFormConfig.children![0],
        children: (customerFormConfig.children![0].children ?? []).map((node) => {
          const p = node.props as Record<string, unknown> | undefined;
          if (p?.name === 'consultant') {
            return consultantVis.visible ? node : { ...node, props: { ...p, __hidden: true } };
          }
          if (p?.name === 'category') {
            return categoryVis.visible
              ? { ...node, props: { ...p, options: categoryOpts } }
              : { ...node, props: { ...p, __hidden: true } };
          }
          return node;
        }),
      },
    ],
  };

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <div style={{ background: '#f3f4f6', padding: '8px 12px', borderRadius: 6, marginBottom: 16, fontSize: 12, color: '#6b7280' }}>
        💡 下面整个表单由一份 JSON 配置渲染（无组件代码）。改配置 = 改 UI。联动规则：选"战略"才显示专属顾问；选 VIP/战略 显示客户类型（选项随等级变化）。
      </div>

      {/* 配置渲染 + 联动 */}
      <UIRoot node={linkedCustomerConfig} ctx={ctx} />

      {/* 自动生成表单（字段定义即表单） */}
      <div style={{ marginTop: 24 }}>
        <UIRoot node={autoFormConfig} ctx={ctx} />
        {Object.keys(errors).length > 0 && (
          <div style={{ color: '#ef4444', fontSize: 13, marginTop: 8 }}>
            {Object.entries(errors).map(([f, es]) => (
              <div key={f}>⚠ {f}: {es.join('; ')}</div>
            ))}
          </div>
        )}
        <button
          onClick={handleSubmit}
          style={{ marginTop: 12, padding: '8px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
        >
          校验（提交）
        </button>
        {submitted && Object.keys(errors).length === 0 && (
          <span style={{ color: '#22c55e', fontSize: 13, marginLeft: 12 }}>✅ 校验通过</span>
        )}
      </div>

      {/* 显示当前配置 JSON（展示"配置即数据"） */}
      <div style={{ marginTop: 32 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#374151' }}>当前配置（JSON，可序列化 / agent 可生成）</div>
        <pre style={{ background: '#0f172a', color: '#e2e8f0', padding: 16, borderRadius: 8, fontSize: 11, overflow: 'auto', maxHeight: 300 }}>
          {JSON.stringify(linkedCustomerConfig, null, 2)}
        </pre>
      </div>
    </div>
  );
}
