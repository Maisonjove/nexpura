import { describe, it, expect } from 'vitest';
import { createAuditDiff } from '../audit-utils';

describe('createAuditDiff', () => {
  it('returns empty changed object when both are empty', () => {
    const result = createAuditDiff({}, {});
    expect(result.changed).toEqual({});
  });

  it('detects added keys', () => {
    const oldData = {};
    const newData = { name: 'John' };
    const result = createAuditDiff(oldData, newData);
    expect(result.changed).toEqual({
      name: { old: undefined, new: 'John' },
    });
  });

  it('detects removed keys', () => {
    const oldData = { name: 'John' };
    const newData = {};
    const result = createAuditDiff(oldData, newData);
    expect(result.changed).toEqual({
      name: { old: 'John', new: undefined },
    });
  });

  it('detects changed values', () => {
    const oldData = { status: 'pending' };
    const newData = { status: 'completed' };
    const result = createAuditDiff(oldData, newData);
    expect(result.changed).toEqual({
      status: { old: 'pending', new: 'completed' },
    });
  });

  it('ignores unchanged values', () => {
    const oldData = { name: 'John', age: 30 };
    const newData = { name: 'John', age: 31 };
    const result = createAuditDiff(oldData, newData);
    expect(result.changed).toEqual({
      age: { old: 30, new: 31 },
    });
    expect(result.changed.name).toBeUndefined();
  });

  it('detects nested object changes', () => {
    const oldData = { config: { theme: 'dark' } };
    const newData = { config: { theme: 'light' } };
    const result = createAuditDiff(oldData, newData);
    expect(result.changed).toEqual({
      config: { old: { theme: 'dark' }, new: { theme: 'light' } },
    });
  });

  it('detects array changes', () => {
    const oldData = { tags: ['a', 'b'] };
    const newData = { tags: ['a', 'c'] };
    const result = createAuditDiff(oldData, newData);
    expect(result.changed).toEqual({
      tags: { old: ['a', 'b'], new: ['a', 'c'] },
    });
  });

  it('handles null to value change', () => {
    const oldData = { field: null };
    const newData = { field: 'value' };
    const result = createAuditDiff(oldData, newData);
    expect(result.changed).toEqual({
      field: { old: null, new: 'value' },
    });
  });

  it('handles value to null change', () => {
    const oldData = { field: 'value' };
    const newData = { field: null };
    const result = createAuditDiff(oldData, newData);
    expect(result.changed).toEqual({
      field: { old: 'value', new: null },
    });
  });

  it('ignores when both are null', () => {
    const oldData = { field: null };
    const newData = { field: null };
    const result = createAuditDiff(oldData, newData);
    expect(result.changed).toEqual({});
  });

  it('ignores when both are undefined', () => {
    const oldData = { field: undefined };
    const newData = { field: undefined };
    const result = createAuditDiff(oldData, newData);
    expect(result.changed).toEqual({});
  });

  it('handles multiple changes at once', () => {
    const oldData = { a: 1, b: 2, c: 3 };
    const newData = { a: 10, b: 2, d: 4 };
    const result = createAuditDiff(oldData, newData);
    expect(Object.keys(result.changed).sort()).toEqual(['a', 'c', 'd']);
    expect(result.changed.a).toEqual({ old: 1, new: 10 });
    expect(result.changed.c).toEqual({ old: 3, new: undefined });
    expect(result.changed.d).toEqual({ old: undefined, new: 4 });
  });
});
