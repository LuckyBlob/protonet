import { describe, it, expect } from 'vitest';
import * as MathHelp from '@/lib/helper/mathHelp';

describe('calculateTotalQuantityMap', () =>
{
    it('returns 0 for an empty map', () =>
    {
        const map: Map<number, number> = new Map();
        const result: number = MathHelp.calculateTotalQuantityMap(map);
        expect(result).toBe(0);
    });

    it('sums all values', () =>
    {
        const map: Map<number, number> = new Map([[1, 10], [2, 20], [3, 30]]);
        const result: number = MathHelp.calculateTotalQuantityMap(map);
        expect(result).toBe(60);
    });

    it('handles a single entry', () =>
    {
        const map: Map<number, number> = new Map([[5, 42]]);
        const result: number = MathHelp.calculateTotalQuantityMap(map);
        expect(result).toBe(42);
    });
});

describe('hasQuantities', () =>
{
    it('returns true when all required quantities are available', () =>
    {
        const store: Map<number, number> = new Map([[1, 100], [2, 50]]);
        const required: Map<number, number> = new Map([[1, 50], [2, 50]]);
        const result: boolean = MathHelp.hasQuantities(required, (type: number): number | undefined => store.get(type));
        expect(result).toBe(true);
    });

    it('returns true when store exactly meets the required amounts', () =>
    {
        const store: Map<number, number> = new Map([[1, 50]]);
        const required: Map<number, number> = new Map([[1, 50]]);
        const result: boolean = MathHelp.hasQuantities(required, (type: number): number | undefined => store.get(type));
        expect(result).toBe(true);
    });

    it('returns false when any quantity falls short', () =>
    {
        const store: Map<number, number> = new Map([[1, 10], [2, 50]]);
        const required: Map<number, number> = new Map([[1, 100], [2, 50]]);
        const result: boolean = MathHelp.hasQuantities(required, (type: number): number | undefined => store.get(type));
        expect(result).toBe(false);
    });

    it('returns false when a required type is missing from the store', () =>
    {
        const store: Map<number, number> = new Map([[1, 100]]);
        const required: Map<number, number> = new Map([[2, 10]]);
        const result: boolean = MathHelp.hasQuantities(required, (type: number): number | undefined => store.get(type));
        expect(result).toBe(false);
    });

    it('returns true for an empty requirements map', () =>
    {
        const store: Map<number, number> = new Map([[1, 100]]);
        const required: Map<number, number> = new Map();
        const result: boolean = MathHelp.hasQuantities(required, (type: number): number | undefined => store.get(type));
        expect(result).toBe(true);
    });
});

describe('addQuantitiesTogether', () =>
{
    it('merges two maps by summing shared keys', () =>
    {
        const map1: Map<number, number> = new Map([[1, 10], [2, 20]]);
        const map2: Map<number, number> = new Map([[2, 5], [3, 30]]);
        const result: Map<number, number> = MathHelp.addQuantitiesTogether(map1, map2);
        expect(result.get(1)).toBe(10);
        expect(result.get(2)).toBe(25);
        expect(result.get(3)).toBe(30);
    });

    it('handles keys only in the first map', () =>
    {
        const map1: Map<number, number> = new Map([[1, 10]]);
        const map2: Map<number, number> = new Map([[2, 5]]);
        const result: Map<number, number> = MathHelp.addQuantitiesTogether(map1, map2);
        expect(result.get(1)).toBe(10);
        expect(result.get(2)).toBe(5);
    });

    it('does not mutate the first map', () =>
    {
        const map1: Map<number, number> = new Map([[1, 10]]);
        const map2: Map<number, number> = new Map([[1, 5]]);
        MathHelp.addQuantitiesTogether(map1, map2);
        expect(map1.get(1)).toBe(10);
    });
});

describe('subtractQuantities', () =>
{
    it('subtracts values via callbacks and updates the store', () =>
    {
        const store: Map<number, number> = new Map([[1, 100], [2, 50]]);
        const toSubtract: Map<number, number> = new Map([[1, 30], [2, 20]]);

        MathHelp.subtractQuantities(
            toSubtract,
            (type: number): number | undefined => store.get(type),
            (type: number, value: number): void => { store.set(type, value); },
        );

        expect(store.get(1)).toBe(70);
        expect(store.get(2)).toBe(30);
    });

    it('throws when the result would go below zero', () =>
    {
        const store: Map<number, number> = new Map([[1, 10]]);
        const toSubtract: Map<number, number> = new Map([[1, 100]]);

        expect(() =>
        {
            MathHelp.subtractQuantities(
                toSubtract,
                (type: number): number | undefined => store.get(type),
                (type: number, value: number): void => { store.set(type, value); },
            );
        }).toThrow();
    });

    it('throws when subtracting a type not present in the store', () =>
    {
        const store: Map<number, number> = new Map();
        const toSubtract: Map<number, number> = new Map([[1, 10]]);

        expect(() =>
        {
            MathHelp.subtractQuantities(
                toSubtract,
                (type: number): number | undefined => store.get(type),
                (type: number, value: number): void => { store.set(type, value); },
            );
        }).toThrow();
    });
});

describe('addQuantities', () =>
{
    it('adds values via callbacks and updates the store', () =>
    {
        const store: Map<number, number> = new Map([[1, 100], [2, 50]]);
        const toAdd: Map<number, number> = new Map([[1, 30], [2, 20]]);

        MathHelp.addQuantities(
            toAdd,
            (type: number): number | undefined => store.get(type),
            (type: number, value: number): void => { store.set(type, value); },
        );

        expect(store.get(1)).toBe(130);
        expect(store.get(2)).toBe(70);
    });

    it('throws when adding to a type not present in the store', () =>
    {
        const store: Map<number, number> = new Map();
        const toAdd: Map<number, number> = new Map([[1, 10]]);

        expect(() =>
        {
            MathHelp.addQuantities(
                toAdd,
                (type: number): number | undefined => store.get(type),
                (type: number, value: number): void => { store.set(type, value); },
            );
        }).toThrow();
    });
});
