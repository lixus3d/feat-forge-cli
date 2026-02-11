import { merge, mergeConcatArrays, mergeDropUndefined } from '@/lib/merger';

describe('merge', () => {
    it('should merge two objects', () => {
        const a = merge({ a: 1 }, { b: 2 });
        expect(a).toEqual({ a: 1, b: 2 });
    });

    it('should merge config class correctly (typical usecase)', () => {
        class ConfigA {
            a = 1;
            b = 2;
            constructor(config?: any) {
                if (config) {
                    merge(this, config);
                }
            }
        }
        const config = new ConfigA({ b: 3 });
        expect(config instanceof ConfigA).toBeTruthy();
        expect(config.a).toEqual(1);
        expect(config.b).toEqual(3);
    });

    it('should deep merge config class correctly (typical usecase)', () => {
        class ConfigB {
            a = 1;
            b = { c: 2, d: 3 };
            constructor(config?: any) {
                if (config) {
                    merge(this, config);
                }
            }
        }
        const config = new ConfigB({ b: { c: 9 } });
        expect(config.a).toEqual(1);
        expect(config.b).toEqual({ c: 9, d: 3 });
    });

    it('should handle date property correctly', () => {
        class ConfigC {
            a = 1;
            b = new Date('2020-01-01');
            constructor(config: Partial<ConfigC> = {}) {
                merge(this, config);
            }
        }
        const config = new ConfigC({ b: new Date('2021-05-05') });
        expect(config.a).toEqual(1);
        expect(config.b).toEqual(new Date('2021-05-05'));
    });

    it('should handle sub class property', () => {
        class SubClass {
            x = 10;
            y = 20;
            constructor(config: Partial<SubClass> = {}) {
                merge(this, config);
            }
        }
        class ConfigC {
            a = 1;
            b = new SubClass();
            constructor(config: Partial<Omit<ConfigC, 'b'> & { b: Partial<SubClass> }> = {}) {
                merge(this, config);
            }
        }
        const config = new ConfigC({ b: { x: 15 } });
        expect(config.a).toEqual(1);
        expect(config.b).toEqual({ x: 15, y: 20 });
        expect(config.b instanceof SubClass).toBeTruthy();
    });

    it('should replace array', () => {
        class ConfigD {
            a = 1;
            b = [1, 2, 3];
            constructor(config: Partial<ConfigD> = {}) {
                merge(this, config);
            }
        }
        const config = new ConfigD({ b: [4, 5] });
        expect(config.a).toEqual(1);
        expect(config.b).toEqual([4, 5]);
    });

    it('should not modify source objects', () => {
        const source1 = { a: 1, b: { c: 2 } };
        const source2 = { b: { d: 3 } };
        const merged = merge({}, source1, source2);
        expect(merged).toEqual({ a: 1, b: { c: 2, d: 3 } });
        expect(source1).toEqual({ a: 1, b: { c: 2 } });
        expect(source2).toEqual({ b: { d: 3 } });
    });

    it('should do nothing on non-object target', () => {
        const result = merge(42 as any, { a: 1 });
        expect(result).toEqual(42);
    });

    it('should do nothing on non-object source', () => {
        const target = { a: 1 };
        const result = merge(target, 42 as any);
        expect(result).toEqual({ a: 1 });
    });

    it('should drop prototype properties', () => {
        const proto = { inherited: 'inherited' };
        const source = Object.create(proto);
        source.own = 'own';
        const result = merge({}, source);
        expect(result).toEqual({ own: 'own' });
        expect(result).not.toHaveProperty('inherited');
    });
});

describe('mergeConcatArrays', () => {
    it('should merge arrays', () => {
        const a = mergeConcatArrays({ a: [1, 2] }, { a: [3, 4] });
        expect(a).toEqual({ a: [1, 2, 3, 4] });
    });

    it('should deep merge and concat arrays', () => {
        const a = mergeConcatArrays({ a: { b: [1, 2], c: 3 } }, { a: { b: [3, 4] } });
        expect(a).toEqual({ a: { b: [1, 2, 3, 4], c: 3 } });
    });

    it('should replace non-array with array', () => {
        const a = mergeConcatArrays({ b: 1 }, { a: [2, 3] });
        expect(a).toEqual({ b: 1, a: [2, 3] });
    });

    it('should keep class instances if custom array', () => {
        class CustomCollection extends Array<any> {}
        const a = mergeConcatArrays({ a: new CustomCollection(1, 2) }, { a: [3, 4] });
        expect(a.a instanceof CustomCollection).toBeTruthy();
        expect(a).toEqual({ a: new CustomCollection(1, 2, 3, 4) });
    });
});

describe('mergeDropUndefined', () => {
    it('should drop undefined values', () => {
        const a = mergeDropUndefined({ a: 1, b: 2 }, { b: undefined, c: 3 });
        expect(a).toEqual({ a: 1, b: 2, c: 3 });
    });

    it('should keep null values', () => {
        const a = mergeDropUndefined({ a: 1, b: 2 }, { b: null, c: 3 });
        expect(a).toEqual({ a: 1, b: null, c: 3 });
    });
});
