/**
 * Unit tests for @voya/contracts — canonicalize.ts
 *
 * Tests cover:
 *  - Deterministic key ordering across different insertion orders
 *  - Nested object and array canonicalization
 *  - Rejection of unsupported value types (undefined, function, symbol, bigint)
 *  - Circular reference detection
 *  - Non-finite number rejection
 *  - buildAuditHashInput stability
 */

import { describe, it, expect } from 'vitest';
import {
  canonicalizeObject,
  buildAuditHashInput,
  CanonicalizationError,
} from '../../src/audit/canonicalize.js';
import {
  sourcingOrderEvent,
  hvmiFallbackDisclosureEvent,
} from '../fixtures/audit-events.js';

// ---------------------------------------------------------------------------
// Key ordering stability
// ---------------------------------------------------------------------------

describe('canonicalizeObject() — key ordering', () => {
  it('produces the same output regardless of insertion order', () => {
    const a = canonicalizeObject({ z: 1, a: 2, m: 3 });
    const b = canonicalizeObject({ m: 3, z: 1, a: 2 });
    const c = canonicalizeObject({ a: 2, m: 3, z: 1 });
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('sorts keys at the top level', () => {
    const result = canonicalizeObject({ z: 'last', a: 'first', m: 'mid' });
    const parsed = JSON.parse(result) as Record<string, unknown>;
    const keys = Object.keys(parsed);
    expect(keys).toEqual(['a', 'm', 'z']);
  });

  it('sorts nested object keys recursively', () => {
    const a = canonicalizeObject({ outer: { z: 1, a: 2 } });
    const b = canonicalizeObject({ outer: { a: 2, z: 1 } });
    expect(a).toBe(b);
  });

  it('objects with same keys and values always produce the same hash input', () => {
    const event1Fields = {
      eventId:            sourcingOrderEvent.eventId,
      eventType:          sourcingOrderEvent.eventType,
      actorType:          sourcingOrderEvent.actor.actorType,
      actorRef:           sourcingOrderEvent.actor.actorRef,
      occurredAt:         sourcingOrderEvent.occurredAt,
      resourceType:       sourcingOrderEvent.resource.resourceType,
      resourceRef:        sourcingOrderEvent.resource.resourceRef,
      correlationId:      sourcingOrderEvent.correlationId,
      dataClassification: sourcingOrderEvent.dataClassification,
    };
    const out1 = canonicalizeObject(event1Fields);
    // Reorder keys
    const event2Fields = {
      dataClassification: event1Fields.dataClassification,
      correlationId:      event1Fields.correlationId,
      resourceRef:        event1Fields.resourceRef,
      resourceType:       event1Fields.resourceType,
      occurredAt:         event1Fields.occurredAt,
      actorRef:           event1Fields.actorRef,
      actorType:          event1Fields.actorType,
      eventType:          event1Fields.eventType,
      eventId:            event1Fields.eventId,
    };
    const out2 = canonicalizeObject(event2Fields);
    expect(out1).toBe(out2);
  });
});

// ---------------------------------------------------------------------------
// Primitive value handling
// ---------------------------------------------------------------------------

describe('canonicalizeObject() — primitive values', () => {
  it('preserves null values', () => {
    const result = canonicalizeObject({ a: null });
    expect(result).toBe('{"a":null}');
  });

  it('preserves boolean values', () => {
    const result = canonicalizeObject({ t: true, f: false });
    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed['t']).toBe(true);
    expect(parsed['f']).toBe(false);
  });

  it('preserves string values', () => {
    const result = canonicalizeObject({ s: 'hello world' });
    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed['s']).toBe('hello world');
  });

  it('preserves integer values', () => {
    const result = canonicalizeObject({ n: 42 });
    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed['n']).toBe(42);
  });

  it('preserves array values', () => {
    const result = canonicalizeObject({ arr: [3, 1, 2] });
    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed['arr']).toEqual([3, 1, 2]);
  });

  it('does NOT sort array elements (only object keys)', () => {
    const result = canonicalizeObject({ arr: ['c', 'a', 'b'] });
    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed['arr']).toEqual(['c', 'a', 'b']);
  });
});

// ---------------------------------------------------------------------------
// Unsupported value types — must throw CanonicalizationError
// ---------------------------------------------------------------------------

describe('canonicalizeObject() — unsupported types throw CanonicalizationError', () => {
  it('throws on undefined values', () => {
    expect(() =>
      canonicalizeObject({ a: undefined } as unknown as Record<string, unknown>),
    ).toThrow(CanonicalizationError);
  });

  it('throws on function values', () => {
    expect(() =>
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      canonicalizeObject({ fn: () => {} } as unknown as Record<string, unknown>),
    ).toThrow(CanonicalizationError);
  });

  it('throws on symbol values', () => {
    expect(() =>
      canonicalizeObject({ sym: Symbol('test') } as unknown as Record<string, unknown>),
    ).toThrow(CanonicalizationError);
  });

  it('throws on bigint values', () => {
    expect(() =>
      canonicalizeObject({ big: BigInt(9007199254740991) } as unknown as Record<string, unknown>),
    ).toThrow(CanonicalizationError);
  });

  it('throws on Infinity', () => {
    expect(() =>
      canonicalizeObject({ n: Infinity }),
    ).toThrow(CanonicalizationError);
  });

  it('throws on NaN', () => {
    expect(() =>
      canonicalizeObject({ n: NaN }),
    ).toThrow(CanonicalizationError);
  });

  it('CanonicalizationError has a path property', () => {
    let error: CanonicalizationError | null = null;
    try {
      canonicalizeObject({ a: undefined } as unknown as Record<string, unknown>);
    } catch (e) {
      if (e instanceof CanonicalizationError) error = e;
    }
    expect(error).not.toBeNull();
    expect(typeof error?.path).toBe('string');
  });

  it('CanonicalizationError includes the field path in its path property', () => {
    let error: CanonicalizationError | null = null;
    try {
      canonicalizeObject({ nested: { deep: undefined } } as unknown as Record<string, unknown>);
    } catch (e) {
      if (e instanceof CanonicalizationError) error = e;
    }
    expect(error?.path).toContain('deep');
  });
});

// ---------------------------------------------------------------------------
// Circular reference detection
// ---------------------------------------------------------------------------

describe('canonicalizeObject() — circular reference detection', () => {
  it('throws CanonicalizationError for circular object references', () => {
    const circular: Record<string, unknown> = { a: 1 };
    circular['self'] = circular;
    expect(() => canonicalizeObject(circular)).toThrow(CanonicalizationError);
  });

  it('throws CanonicalizationError for circular array references', () => {
    const arr: unknown[] = [1, 2];
    arr.push(arr);
    expect(() => canonicalizeObject({ arr })).toThrow(CanonicalizationError);
  });
});

// ---------------------------------------------------------------------------
// buildAuditHashInput()
// ---------------------------------------------------------------------------

describe('buildAuditHashInput()', () => {
  it('produces a non-empty string', () => {
    const result = buildAuditHashInput({
      eventId:            sourcingOrderEvent.eventId,
      eventType:          sourcingOrderEvent.eventType,
      actorType:          sourcingOrderEvent.actor.actorType,
      actorRef:           sourcingOrderEvent.actor.actorRef,
      occurredAt:         sourcingOrderEvent.occurredAt,
      resourceType:       sourcingOrderEvent.resource.resourceType,
      resourceRef:        sourcingOrderEvent.resource.resourceRef,
      correlationId:      sourcingOrderEvent.correlationId,
      dataClassification: sourcingOrderEvent.dataClassification,
    });
    expect(result.length).toBeGreaterThan(0);
  });

  it('is stable across two identical calls with different field order', () => {
    const base = {
      eventId:            sourcingOrderEvent.eventId,
      eventType:          sourcingOrderEvent.eventType,
      actorType:          sourcingOrderEvent.actor.actorType,
      actorRef:           sourcingOrderEvent.actor.actorRef,
      occurredAt:         sourcingOrderEvent.occurredAt,
      resourceType:       sourcingOrderEvent.resource.resourceType,
      resourceRef:        sourcingOrderEvent.resource.resourceRef,
      correlationId:      sourcingOrderEvent.correlationId,
      dataClassification: sourcingOrderEvent.dataClassification,
    };
    const result1 = buildAuditHashInput(base);
    const result2 = buildAuditHashInput({
      dataClassification: base.dataClassification,
      correlationId:      base.correlationId,
      resourceRef:        base.resourceRef,
      resourceType:       base.resourceType,
      occurredAt:         base.occurredAt,
      actorRef:           base.actorRef,
      actorType:          base.actorType,
      eventType:          base.eventType,
      eventId:            base.eventId,
    });
    expect(result1).toBe(result2);
  });

  it('produces different output for different events', () => {
    const out1 = buildAuditHashInput({
      eventId:            sourcingOrderEvent.eventId,
      eventType:          sourcingOrderEvent.eventType,
      actorType:          sourcingOrderEvent.actor.actorType,
      actorRef:           sourcingOrderEvent.actor.actorRef,
      occurredAt:         sourcingOrderEvent.occurredAt,
      resourceType:       sourcingOrderEvent.resource.resourceType,
      resourceRef:        sourcingOrderEvent.resource.resourceRef,
      correlationId:      sourcingOrderEvent.correlationId,
      dataClassification: sourcingOrderEvent.dataClassification,
    });
    const out2 = buildAuditHashInput({
      eventId:            hvmiFallbackDisclosureEvent.eventId,
      eventType:          hvmiFallbackDisclosureEvent.eventType,
      actorType:          hvmiFallbackDisclosureEvent.actor.actorType,
      actorRef:           hvmiFallbackDisclosureEvent.actor.actorRef,
      occurredAt:         hvmiFallbackDisclosureEvent.occurredAt,
      resourceType:       hvmiFallbackDisclosureEvent.resource.resourceType,
      resourceRef:        hvmiFallbackDisclosureEvent.resource.resourceRef,
      correlationId:      hvmiFallbackDisclosureEvent.correlationId,
      dataClassification: hvmiFallbackDisclosureEvent.dataClassification,
    });
    expect(out1).not.toBe(out2);
  });

  it('matches the pre-computed canonicalHashInput stored in the fixture', () => {
    const recomputed = buildAuditHashInput({
      eventId:            sourcingOrderEvent.eventId,
      eventType:          sourcingOrderEvent.eventType,
      actorType:          sourcingOrderEvent.actor.actorType,
      actorRef:           sourcingOrderEvent.actor.actorRef,
      occurredAt:         sourcingOrderEvent.occurredAt,
      resourceType:       sourcingOrderEvent.resource.resourceType,
      resourceRef:        sourcingOrderEvent.resource.resourceRef,
      correlationId:      sourcingOrderEvent.correlationId,
      dataClassification: sourcingOrderEvent.dataClassification,
    });
    expect(recomputed).toBe(sourcingOrderEvent.canonicalHashInput);
  });
});
