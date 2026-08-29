// ============================================
// 公式引擎单测（vitest）
// ============================================
import { describe, it, expect } from 'vitest';
import { evaluateFormula, extractFormulaFields } from '../src/core/formula';
import { renderTemplate, extractTemplateFields } from '../src/core/template';

describe('formula 引擎', () => {
  it('基础乘法 {金额} * {数量}', () => {
    const r = evaluateFormula('{金额} * {数量}', { 金额: 100, 数量: 2 });
    expect(r.error).toBeNull();
    expect(r.value).toBe(200);
  });

  it('复杂公式 (a+b)*c', () => {
    const r = evaluateFormula('({单价} + {税费}) * {数量}', { 单价: 10, 税费: 2, 数量: 3 });
    expect(r.error).toBeNull();
    expect(r.value).toBe(36);
  });

  it('非法表达式返回 error 不抛异常', () => {
    const r = evaluateFormula('{金额} **', { 金额: 100 });
    expect(r.value).toBeNull();
    expect(r.error).not.toBeNull();
  });

  it('字段缺失返回 error', () => {
    const r = evaluateFormula('{金额} * {数量}', { 金额: 100 });
    expect(r.error).toContain('数量');
  });

  it('禁止危险函数（import/createUnit）', () => {
    const r = evaluateFormula('createUnit("x")', {});
    expect(r.error).not.toBeNull();
  });

  it('禁止属性访问（原型链逃逸）', () => {
    const r = evaluateFormula('{a}.constructor', { a: 1 });
    expect(r.error).not.toBeNull();
  });

  it('extractFormulaFields 提取字段名', () => {
    const fields = extractFormulaFields('{金额} * {数量} + {金额}');
    expect(fields).toEqual(['金额', '数量']);
  });

  it('编译缓存：同公式多次求值一致', () => {
    const r1 = evaluateFormula('{x} * 2', { x: 3 });
    const r2 = evaluateFormula('{x} * 2', { x: 5 });
    expect(r1.value).toBe(6);
    expect(r2.value).toBe(10);
  });
});

describe('template 模板引擎', () => {
  it('占位符替换', () => {
    const out = renderTemplate('客户 {{name}} 金额 {{amount}}', { name: '张三', amount: 100 });
    expect(out).toBe('客户 张三 金额 100');
  });

  it('缺失字段显示空', () => {
    const out = renderTemplate('{{a}}-{{b}}', { a: 1 });
    expect(out).toBe('1-');
  });

  it('extractTemplateFields', () => {
    expect(extractTemplateFields('{{x}} 和 {{y}}')).toEqual(['x', 'y']);
  });
});
