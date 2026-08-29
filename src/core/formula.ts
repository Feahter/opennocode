// ============================================
// 安全公式引擎 - 基于 mathjs
// ============================================
// 特性：
// - 支持 {字段名} 占位符，替换为安全变量名后绑定到 mathjs scope
// - 字段白名单校验：表达式引用的字段必须在 data 中存在
// - 非法表达式 / 字段缺失 → 返回 { value: null, error }，绝不抛异常
// - 禁止 eval 调用；通过 AST 校验禁用 mathjs 的 import / createUnit /
//   parse / compile / evaluate 等危险功能，并禁止属性访问（AccessorNode）
// 纯函数，不依赖 React。

import { parse, type MathNode } from 'mathjs';

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

export interface FormulaResult {
  value: unknown;
  error: string | null;
}

interface CompiledEntry {
  /** mathjs 编译后的表达式（调用 evaluate(scope) 求值） */
  evaluate: (scope: Record<string, unknown>) => unknown;
  /** 占位符字段名 → scope 变量名 的映射（与编译结果一一对应） */
  varNames: string[];
}

// ---------------------------------------------------------------------------
// 常量与配置
// ---------------------------------------------------------------------------

/** 占位符：{字段名}（字段名内不允许嵌套花括号） */
const FIELD_PLACEHOLDER_RE = /\{([^{}]+)\}/g;

/** mathjs 内置常量（SymbolNode 形式出现，需显式放行） */
const MATH_CONSTANTS = new Set([
  'pi', 'tau', 'e', 'i', 'phi',
  'Infinity', 'NaN', 'true', 'false', 'null',
]);

/**
 * 危险 / 非数值型 mathjs 函数黑名单。
 * - 可注入环境或执行代码：import / createUnit / evaluate / compile / parse / typed / factory / create / resolve
 * - 符号运算（性能风险、非数值语义）：derivative / simplify / rationalize / expand / factor 等
 */
const FORBIDDEN_FUNCTIONS = new Set([
  // 代码 / 环境注入
  'import', 'createUnit', 'evaluate', 'compile', 'parse',
  'typed', 'factory', 'create', 'resolve',
  // 符号运算
  'derivative', 'symbolicDerivative', 'simplify', 'rationalize',
  'expand', 'factor', 'polynomialRoot', 'compareText',
  // 单位与格式化
  'unit', 'splitUnit', 'to', 'print', 'format', 'config',
]);

/** 允许的属性访问/赋值/对象/块等结构一律拒绝（防 prototype 链逃逸） */
const FORBIDDEN_NODE_TYPES = new Set([
  'AccessorNode',   // x.y / x.y() → 可达 Function 构造器
  'IndexNode',      // x[0] / x['prop']
  'AssignmentNode', // x = ...
  'ObjectNode',     // { a: 1 }
  'BlockNode',      // ; 分隔的多语句
]);

/** 编译结果缓存上限（防内存无限增长） */
const COMPILE_CACHE_LIMIT = 200;

// ---------------------------------------------------------------------------
// 内部工具
// ---------------------------------------------------------------------------

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** 公式字段提取：返回表达式中出现的 {字段名} 列表（按首次出现顺序，去重） */
export function extractFormulaFields(expression: string): string[] {
  const fields: string[] = [];
  const seen = new Set<string>();
  for (const match of String(expression ?? '').matchAll(FIELD_PLACEHOLDER_RE)) {
    const name = match[1].trim();
    if (name && !seen.has(name)) {
      seen.add(name);
      fields.push(name);
    }
  }
  return fields;
}

/** 规范化 mathjs 返回结果：BigNumber / Fraction / Unit 等转为普通 number */
function normalizeResult(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  const t = typeof value;
  if (t === 'number' || t === 'string' || t === 'boolean') return value;
  if (Array.isArray(value)) return value.map(normalizeResult);
  const v = value as { toNumber?: () => number; toArray?: () => unknown[] };
  if (typeof v.toNumber === 'function') {
    try {
      const n = v.toNumber();
      return Number.isFinite(n) ? n : value;
    } catch {
      /* 无量纲单位等无法转换 → 走 toArray / 原样返回 */
    }
  }
  if (typeof v.toArray === 'function') {
    try { return v.toArray().map(normalizeResult); } catch { /* 原样返回 */ }
  }
  return value;
}

// ---------------------------------------------------------------------------
// 核心：AST 安全校验
// ---------------------------------------------------------------------------

/**
 * 校验 mathjs 解析树：
 * - 拒绝属性访问 / 赋值 / 对象 / 块等结构
 * - 拒绝黑名单函数
 * - 未知符号（非 scope 变量、非 mathjs 常量、非已放行函数名）一律拒绝
 */
function validateTree(
  tree: MathNode,
  scopeVars: Set<string>,
): string | null {
  const knownFunctions = new Set<string>();
  let error: string | null = null;

  tree.traverse((node: MathNode) => {
    if (error) return;

    if (FORBIDDEN_NODE_TYPES.has(node.type)) {
      error = `公式包含不支持的语法（${node.type}）`;
      return;
    }

    if (node.type === 'FunctionNode') {
      const name = (node as { fn?: { name?: string } }).fn?.name ?? '';
      if (FORBIDDEN_FUNCTIONS.has(name)) {
        error = `函数 "${name}" 不允许在公式中使用`;
        return;
      }
      knownFunctions.add(name);
      return;
    }

    if (node.type === 'SymbolNode') {
      const name = (node as { name?: string }).name ?? '';
      if (scopeVars.has(name)) return;
      if (MATH_CONSTANTS.has(name)) return;
      if (knownFunctions.has(name)) return;
      error = `未知符号 "${name}"（请确认字段名拼写，字段需用 {字段名} 引用）`;
    }
  });

  return error;
}

// ---------------------------------------------------------------------------
// 编译缓存（极致性能：同一条公式只 parse + compile 一次）
// ---------------------------------------------------------------------------

const compileCache = new Map<string, CompiledEntry>();

function getCompiled(expression: string): CompiledEntry | string {
  const cacheKey = expression;
  const cached = compileCache.get(cacheKey);
  if (cached) return cached;

  // 1. 占位符 → 安全变量名（替换逻辑与 data 无关，可安全缓存）
  const varNames: string[] = [];
  const varByField = new Map<string, string>();
  const replaced = expression.replace(FIELD_PLACEHOLDER_RE, (raw, fieldName: string) => {
    const field = fieldName.trim();
    if (!field) return raw; // "{}" 畸形占位符，交给 mathjs 报语法错误
    if (varByField.has(field)) return varByField.get(field)!;
    const varName = `__f${varNames.length}`;
    varNames.push(field);
    varByField.set(field, varName);
    return varName;
  });

  // 2. 解析并做 AST 安全校验
  let tree: MathNode;
  try {
    tree = parse(replaced);
  } catch (e) {
    return `公式语法错误：${errorMessage(e)}`;
  }

  const validationError = validateTree(tree, new Set(varByField.values()));
  if (validationError) return validationError;

  // 3. 编译 + 缓存
  const entry: CompiledEntry = {
    evaluate: tree.compile().evaluate,
    varNames,
  };
  if (compileCache.size >= COMPILE_CACHE_LIMIT) {
    const firstKey = compileCache.keys().next().value as string | undefined;
    if (firstKey !== undefined) compileCache.delete(firstKey);
  }
  compileCache.set(cacheKey, entry);
  return entry;
}

// ---------------------------------------------------------------------------
// 对外 API
// ---------------------------------------------------------------------------

/**
 * 计算公式表达式。
 * @param expression 公式表达式，如 "{金额} * {数量}"
 * @param data       字段名 → 值 的映射
 * @returns { value, error }；成功时 error 为 null，失败时 value 为 null
 */
export function evaluateFormula(expression: string, data: Record<string, unknown>): FormulaResult {
  const expr = String(expression ?? '').trim();
  if (!expr) {
    return { value: null, error: '公式为空' };
  }

  let compiled: CompiledEntry | string;
  try {
    compiled = getCompiled(expr);
  } catch (e) {
    // 理论上不可达（内部错误均已转 string），兜底防逃逸
    return { value: null, error: errorMessage(e) };
  }
  if (typeof compiled === 'string') {
    return { value: null, error: compiled };
  }

  try {
    // 每次求值重建 scope：白名单校验（字段必须存在且有值）在此执行
    const scope: Record<string, unknown> = {};
    for (let i = 0; i < compiled.varNames.length; i++) {
      const field = compiled.varNames[i];
      if (!Object.prototype.hasOwnProperty.call(data, field)) {
        return { value: null, error: `字段缺失：{${field}} 未提供` };
      }
      const value = data[field];
      if (value === null || value === undefined) {
        return { value: null, error: `字段无值：{${field}} 当前为空` };
      }
      scope[`__f${i}`] = value;
    }
    const raw = compiled.evaluate(scope);
    return { value: normalizeResult(raw), error: null };
  } catch (e) {
    return { value: null, error: `公式计算失败：${errorMessage(e)}` };
  }
}
