// ============================================
// UI 元设计 — 注册中心（收编所有 kind）
// ============================================
// 一次性注册：7 容器 + 8 字段控件。加新控件 = 在此加一行。

import { registerAll } from './registry';
import * as containers from './containers';
import * as fields from './fields';

export function registerBuiltins(): void {
  registerAll({
    // 布局容器（L1）
    'container.page': { component: containers.PageNode },
    'container.tabs': { component: containers.TabsNode },
    'container.grid': { component: containers.GridNode },
    'container.form': { component: containers.FormNode },
    'container.detail': { component: containers.DetailNode },
    'container.modal': { component: containers.ModalNode },
    // 字段控件（L2）
    'field.text': { component: fields.TextField },
    'field.number': { component: fields.NumberField },
    'field.select': { component: fields.SelectField },
    'field.multi_select': { component: fields.MultiSelectField },
    'field.date': { component: fields.DateField },
    'field.checkbox': { component: fields.CheckboxField },
    'field.textarea': { component: fields.TextAreaField },
    'field.display': { component: fields.DisplayField },
  });
}
