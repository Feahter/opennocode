// ============================================
// 核心引擎单测（vitest）：query / permission / statemachine / dsl
// ============================================
import { describe, it, expect } from 'vitest';
import { filterRecords, sortRecords } from '../src/core/query';
import { can, canField } from '../src/core/permission';
import { getStates, canTransition, effectiveState } from '../src/core/statemachine';
import { parseDsl, serializeDsl } from '../src/schema/dsl';
import type { AppRecord, Field, StateMachine } from '../src/types';

const fields: Field[] = [
  { id: 'f1', name: 'name', type: 'text', meta: { label: '名称' }, permissions: [], created_at: 1, updated_at: 1 },
  { id: 'f2', name: 'amount', type: 'number', meta: { label: '金额' }, permissions: [], created_at: 1, updated_at: 1 },
];

const records: AppRecord[] = [
  { id: 'r1', app_id: 'a1', data: { name: '张三', amount: 100 }, created_by: 'u', created_at: 1, updated_at: 1 },
  { id: 'r2', app_id: 'a1', data: { name: '李四', amount: 200 }, created_by: 'u', created_at: 1, updated_at: 1 },
  { id: 'r3', app_id: 'a1', data: { name: '王五', amount: 300 }, created_by: 'u', created_at: 1, updated_at: 1 },
];

describe('query 查询引擎', () => {
  it('filterRecords 按关键字过滤', () => {
    expect(filterRecords(records, fields, '张三')).toHaveLength(1);
    expect(filterRecords(records, fields, '张')).toHaveLength(1);
    expect(filterRecords(records, fields, '')).toHaveLength(3);
  });

  it('sortRecords 数字排序', () => {
    const asc = sortRecords(records, 'amount', 'asc');
    expect(asc[0].data.amount).toBe(100);
    expect(asc[2].data.amount).toBe(300);
    const desc = sortRecords(records, 'amount', 'desc');
    expect(desc[0].data.amount).toBe(300);
  });
});

describe('permission 权限引擎', () => {
  it('角色级权限', () => {
    expect(can('admin', 'delete')).toBe(true);
    expect(can('editor', 'delete')).toBe(false);
    expect(can('viewer', 'create')).toBe(false);
    expect(can('viewer', 'read')).toBe(true);
  });

  it('字段级权限：无配置默认放行', () => {
    expect(canField(fields[0], 'viewer', 'read')).toBe(true);
  });

  it('字段级权限：配置限制生效', () => {
    const restricted: Field = {
      ...fields[0],
      permissions: [{ role_id: 'viewer', create: false, read: false, update: false, delete: false }],
    };
    expect(canField(restricted, 'viewer', 'read')).toBe(false);
    expect(canField(restricted, 'admin', 'read')).toBe(true); // 无 admin 配置默认放行
  });
});

const sm: StateMachine = {
  id: 'sm1',
  name: '订单流程',
  states: [
    { id: 'todo', label: '待处理', color: '#f59e0b' },
    { id: 'doing', label: '进行中', color: '#3b82f6' },
    { id: 'done', label: '已完成', color: '#10b981' },
  ],
  transitions: [
    { id: 't1', from: 'todo', to: 'doing', trigger: 'manual_action' },
    { id: 't2', from: 'doing', to: 'done', trigger: 'manual_action' },
  ],
  initial: 'todo',
};

describe('statemachine 状态机', () => {
  it('getStates 返回状态', () => {
    expect(getStates(sm)).toHaveLength(3);
  });

  it('canTransition 合法迁移', () => {
    expect(canTransition(sm, 'todo', 'doing')).toBe(true);
    expect(canTransition(sm, 'doing', 'done')).toBe(true);
  });

  it('canTransition 非法迁移被拦截', () => {
    expect(canTransition(sm, 'done', 'todo')).toBe(false);
    expect(canTransition(sm, 'todo', 'done')).toBe(false); // 跳级不允许
  });

  it('effectiveState 缺省取 initial', () => {
    expect(effectiveState(sm, undefined)).toBe('todo');
    expect(effectiveState(sm, 'done')).toBe('done');
  });
});

describe('DSL 解析', () => {
  it('parseDsl 解析应用 + 字段', () => {
    const r = parseDsl('app "订单" { field amount:number; field status:select; }');
    expect(r.apps).toHaveLength(1);
    const app = r.apps[0];
    expect(app.name).toBe('订单');
    expect(app.fields).toHaveLength(2);
  });

  it('serializeDsl 序列化', () => {
    const dsl = serializeDsl([{ id: 'a1', name: '客户', type: 'data', fields: ['f1'], views: [], created_at: 1, updated_at: 1 }]);
    expect(dsl).toContain('客户');
  });
});
