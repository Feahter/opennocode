// 工具函数 - 组合优于继承
// P0-3: JS → TS；删除 eval 公式引擎（由 core/formula.ts 的 mathjs 实现替代）

type AnyFn = (...args: any[]) => any;

// 缓存/Memoization
const memo = new Map<string, unknown>();
export function memoize<T>(key: string, fn: () => T): T {
  if (memo.has(key)) return memo.get(key) as T;
  const result = fn();
  memo.set(key, result);
  return result;
}

export function memoizeClear(): void {
  memo.clear();
}

// 防抖 - 高频事件优化
export function debounce<T extends AnyFn>(fn: T, delay = 300): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return function (this: unknown, ...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), delay);
  };
}

// 节流 - 限制执行频率
export function throttle<T extends AnyFn>(fn: T, limit = 100): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return function (this: unknown, ...args: Parameters<T>) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => { inThrottle = false; }, limit);
    }
  };
}

// ID生成
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

// 深拷贝
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// 表单验证
export interface ValidationRule {
  required?: boolean;
  min?: number;
  pattern?: RegExp;
}

export function validate(data: Record<string, unknown>, rules: Record<string, ValidationRule>): string[] {
  const errors: string[] = [];
  for (const [field, rule] of Object.entries(rules)) {
    if (rule.required && !data[field]) {
      errors.push(`${field} 不能为空`);
    }
    if (rule.min && typeof data[field] === 'string' && (data[field] as string).length < rule.min) {
      errors.push(`${field} 至少 ${rule.min} 个字符`);
    }
    if (rule.pattern && typeof data[field] === 'string' && !rule.pattern.test(data[field] as string)) {
      errors.push(`${field} 格式不正确`);
    }
  }
  return errors;
}

// 权限检查
export type Role = 'admin' | 'editor' | 'viewer';
export type Action = 'create' | 'read' | 'update' | 'delete';

const ROLE_PERMISSIONS: Record<Role, Action[]> = {
  admin: ['create', 'read', 'update', 'delete'],
  editor: ['create', 'read', 'update'],
  viewer: ['read'],
};

export function hasPermission(role: Role, action: Action): boolean {
  return ROLE_PERMISSIONS[role]?.includes(action) || false;
}

// 日期格式化
export function formatDate(timestamp: number, format = 'YYYY-MM-DD'): string {
  const d = new Date(timestamp);
  return format
    .replace('YYYY', String(d.getFullYear()))
    .replace('MM', String(d.getMonth() + 1).padStart(2, '0'))
    .replace('DD', String(d.getDate()).padStart(2, '0'))
    .replace('HH', String(d.getHours()).padStart(2, '0'))
    .replace('mm', String(d.getMinutes()).padStart(2, '0'));
}

// 工具集合导出
export default {
  memoize, memoizeClear,
  debounce, throttle,
  generateId, deepClone,
  validate, hasPermission,
  formatDate,
};
