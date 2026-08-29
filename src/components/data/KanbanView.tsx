// ============================================
// 看板视图 - 按状态分列 + dnd-kit 拖拽跨列换状态
// ============================================
// 列 = 状态机 states；无状态机 → 单列「全部」（不可拖拽）
// 拖拽落列 → statemachine.transition() 校验 → 合法 updateRecord，非法提示且卡片不动

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useAppStore } from '../../stores/appStore';
import {
  columnIdForRecord,
  effectiveState,
  getStates,
  resolveStateMachine,
  transition,
} from '../../core/statemachine';
import type { AppRecord, Field, StateMachine } from '../../types';
import { formatDate } from '../../utils/helpers';

interface Column {
  id: string;
  label: string;
  color: string;
}

// 无状态机时的兜底单列
const FALLBACK_COLUMN: Column = { id: '__all__', label: '全部', color: '#9ca3af' };

// ============================================
// 主组件
// ============================================

export function KanbanView() {
  // 精确 selector 订阅，避免无关状态触发重渲染
  const selectedApp = useAppStore((s) => s.selectedApp);
  const records = useAppStore((s) => s.records);
  const allFields = useAppStore((s) => s.fields);
  // 注：appStore.ts 的 AppState 接口暂未声明 updateRecord（P1 并行任务正在扩展该文件，
  // 本任务按约束不修改它）；运行时 store 已实现，此处做类型收窄取用。
  const updateRecord = useAppStore(
    (s) =>
      (s as unknown as { updateRecord: (id: string, updates: Partial<AppRecord>) => void })
        .updateRecord,
  );

  // 解析状态机：内嵌 JSON / 对象；id 引用无法解析时回退「无状态机」
  const sm = useMemo(
    () => resolveStateMachine(selectedApp?.state_machine),
    [selectedApp?.state_machine],
  );

  // 当前应用字段（决定卡片展示哪些字段）
  const appFields = useMemo(() => {
    const ids = new Set(selectedApp?.fields ?? []);
    return allFields.filter((f) => ids.has(f.id));
  }, [allFields, selectedApp?.fields]);

  // 列 = 状态机 states；无状态机 → 单列「全部」
  const columns = useMemo<Column[]>(() => {
    const states = getStates(sm);
    if (states.length === 0) return [FALLBACK_COLUMN];
    return states.map((s) => ({ id: s.id, label: s.label, color: s.color }));
  }, [sm]);

  // 记录按列分组（空列也保留）
  const recordsByColumn = useMemo(() => {
    const map: Record<string, AppRecord[]> = {};
    for (const c of columns) map[c.id] = [];
    for (const r of records) {
      const col = columnIdForRecord(sm, r.state);
      (map[col] ??= []).push(r);
    }
    return map;
  }, [columns, records, sm]);

  // 非法迁移内联提示（auto-dismiss）
  const [hint, setHint] = useState<string | null>(null);
  const hintTimer = useRef<number | null>(null);
  const showHint = useCallback((msg: string) => {
    setHint(msg);
    if (hintTimer.current !== null) window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setHint(null), 2600);
  }, []);
  useEffect(
    () => () => {
      if (hintTimer.current !== null) window.clearTimeout(hintTimer.current);
    },
    [],
  );

  // 拖拽状态
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeRecord = useMemo(
    () => records.find((r) => r.id === activeId) ?? null,
    [records, activeId],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  // 命中检测：指针优先，空隙回退最近角落，保证落列必命中列
  const collisionDetection = useCallback<CollisionDetection>((args) => {
    const pointer = pointerWithin(args);
    if (pointer.length > 0) return pointer;
    return closestCorners(args);
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const recordId = (event.active.data.current as { recordId?: string } | undefined)?.recordId;
    setActiveId(recordId ?? null);
  }, []);

  const handleDragCancel = useCallback(() => setActiveId(null), []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over || !sm) return; // 无状态机不可迁移
      const target =
        (over.data.current as { column?: string } | undefined)?.column ?? String(over.id);
      const recordId = (active.data.current as { recordId?: string } | undefined)?.recordId;
      if (!recordId) return;
      const record = records.find((r) => r.id === recordId);
      if (!record) return;

      const from = effectiveState(sm, record.state);
      if (from === target) return; // 原地 no-op

      const next = transition(sm, from, target);
      if (next === target) {
        // 状态机校验通过 → 持久化换状态
        updateRecord(recordId, { state: target });
      } else {
        // 非法迁移（如 已完成 → 待处理）→ 拦截，卡片不动
        showHint(
          `非法迁移：不能从「${stateLabel(sm, from)}」直接移动到「${stateLabel(sm, target)}」`,
        );
      }
    },
    [records, sm, updateRecord, showHint],
  );

  return (
    <div>
      {/* 头部 */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>{selectedApp?.name ?? '数据'}</h2>
        <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
          {sm
            ? `状态机「${sm.name}」 · ${records.length} 条记录`
            : `无状态机 · ${records.length} 条记录`}
        </div>
      </div>

      {/* 看板列 */}
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div
          style={{
            display: 'flex',
            gap: 16,
            alignItems: 'flex-start',
            overflowX: 'auto',
            paddingBottom: 8,
          }}
        >
          {columns.map((col) => (
            <KanbanColumn
              key={col.id}
              column={col}
              records={recordsByColumn[col.id] ?? []}
              fields={appFields}
              sm={sm}
            />
          ))}
        </div>

        {/* 拖拽浮层 */}
        <DragOverlay>
          {activeRecord ? (
            <div style={{ transform: 'rotate(2deg)', boxShadow: '0 12px 24px rgba(0,0,0,0.2)' }}>
              <CardBody record={activeRecord} fields={appFields} sm={sm} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* 非法迁移内联提示 */}
      {hint && (
        <div
          data-testid="kanban-hint"
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#fef2f2',
            color: '#b91c1c',
            border: '1px solid #fecaca',
            padding: '10px 16px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            zIndex: 100,
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
          }}
        >
          ⚠️ {hint}
        </div>
      )}
    </div>
  );
}

// ============================================
// 列（可放置目标）
// ============================================

function KanbanColumn({
  column,
  records,
  fields,
  sm,
}: {
  column: Column;
  records: AppRecord[];
  fields: Field[];
  sm: StateMachine | null;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { column: column.id },
  });

  return (
    <div
      ref={setNodeRef}
      data-testid="kanban-column"
      data-state-id={column.id}
      style={{
        width: 280,
        flex: '0 0 280px',
        background: isOver ? '#eef2ff' : '#f3f4f6',
        border: isOver ? '2px dashed #6366f1' : '1px solid transparent',
        borderRadius: 10,
        padding: 8,
        minHeight: 140,
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      {/* 列头 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 8px',
          marginBottom: 8,
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: column.color || '#9ca3af',
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{column.label}</span>
        <span
          style={{
            fontSize: 12,
            color: '#6b7280',
            background: '#e5e7eb',
            borderRadius: 9999,
            padding: '1px 8px',
          }}
        >
          {records.length}
        </span>
      </div>

      {/* 卡片列表 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 40 }}>
        {records.length === 0 && (
          <div
            style={{
              fontSize: 12,
              color: '#9ca3af',
              textAlign: 'center',
              padding: '16px 0',
              border: '1px dashed #d1d5db',
              borderRadius: 8,
            }}
          >
            暂无记录
          </div>
        )}
        {records.map((r) => (
          <DraggableCard key={r.id} record={r} fields={fields} sm={sm} />
        ))}
      </div>
    </div>
  );
}

// ============================================
// 卡片（可拖拽源）
// ============================================

function DraggableCard({
  record,
  fields,
  sm,
}: {
  record: AppRecord;
  fields: Field[];
  sm: StateMachine | null;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: record.id,
    data: {
      recordId: record.id,
      from: effectiveState(sm, record.state),
    },
    // 无状态机时禁止拖拽
    disabled: !sm,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-testid="kanban-card"
      data-record-id={record.id}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.35 : 1,
        cursor: sm ? 'grab' : 'default',
        touchAction: 'none',
      }}
    >
      <CardBody record={record} fields={fields} sm={sm} />
    </div>
  );
}

// ============================================
// 卡片主体（标题 + 主要字段 + 状态点）
// ============================================

function CardBody({
  record,
  fields,
  sm,
}: {
  record: AppRecord;
  fields: Field[];
  sm: StateMachine | null;
}) {
  // 展示记录主要字段（有值的前 4 个）
  const entries = useMemo(() => {
    const out: { label: string; value: string }[] = [];
    for (const f of fields) {
      const raw = record.data[f.name] ?? record.data[f.id];
      const value = formatValue(raw);
      if (!value) continue;
      out.push({ label: f.meta.label || f.name, value });
      if (out.length >= 4) break;
    }
    return out;
  }, [record, fields]);

  const title = entries[0]?.value ?? record.id.slice(0, 8);
  const rest = entries.slice(1);

  // 当前状态点（无 state 时视为 initial）
  const stateInfo = useMemo(() => {
    if (!sm) return null;
    const stateId = record.state || sm.initial;
    return getStates(sm).find((s) => s.id === stateId) ?? null;
  }, [sm, record.state]);

  return (
    <div
      className="card"
      style={{ padding: 10, borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            flex: 1,
            fontSize: 13,
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </div>
        {stateInfo && (
          <span
            title={stateInfo.label}
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: stateInfo.color || '#9ca3af',
              flexShrink: 0,
            }}
          />
        )}
      </div>

      {rest.map((e, i) => (
        <div
          key={i}
          style={{
            fontSize: 12,
            color: '#6b7280',
            marginTop: 4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ color: '#9ca3af' }}>{e.label}: </span>
          {e.value}
        </div>
      ))}

      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
        {record.updated_at ? formatDate(record.updated_at) : ''}
      </div>
    </div>
  );
}

// ============================================
// 工具函数
// ============================================

function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function stateLabel(sm: StateMachine | null, id: string): string {
  return getStates(sm).find((s) => s.id === id)?.label ?? id;
}
