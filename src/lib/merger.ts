export interface ObjectLiteral {
    [key: string]: any;
}

export type Simplify<T> = { [KeyType in keyof T]: T[KeyType] } & {};

function isObject(item: any) {
    return item && typeof item === 'object' && item !== null;
}

function isArray(item: any): item is any[] {
    return Array.isArray(item);
}

export class MergerOptions {
    /**
     * If true, arrays will be merged instead of replaced
     * @default false
     */
    mergeArrays: boolean = false;
    /**
     * If true, undefined values in sources will be merged and overwrite existing values in target.
     * If false, undefined values will be ignored.
     */
    mergeUndefined: boolean = true;

    constructor(options: Simplify<Partial<MergerOptions>> = {}) {
        Object.assign(this, options);
    }
}

/**
 * Class that provides a merge function to deep merge objects
 * with options
 */
export class Merger {
    constructor(private options: Simplify<Partial<MergerOptions>> = {}) {
        this.options = Object.assign(new MergerOptions(), options);
    }

    static build(options: Simplify<Partial<MergerOptions>> = {}): Merger {
        return new Merger(options);
    }

    /**
     * Like Object.assign but will do a deep merge
     * @param target where all sources will be merged
     * @param sources what to merge into target, one or multiple
     * @returns
     */
    public merge<T extends ObjectLiteral>(target: T, ...sources: ObjectLiteral[]): T {
        if (isObject(target)) {
            let sLen = sources.length;
            for (let i = 0; i < sLen; i++) {
                const source = sources[i];
                if (isObject(source)) {
                    for (const key in source) {
                        if (source.hasOwnProperty(key)) {
                            if (source[key] instanceof Date) {
                                (target as any)[key] = new Date(source[key].getTime());
                            } else if (isArray(source[key])) {
                                if (this.options.mergeArrays) {
                                    (target as any)[key] = ((target as any)[key] || []).concat(source[key]);
                                } else {
                                    (target as any)[key] = source[key].slice();
                                }
                            } else if (isObject(source[key])) {
                                if (!target[key]) {
                                    (target as any)[key] = {};
                                }
                                this.merge(target[key], source[key]);
                            } else {
                                if (source[key] === undefined && !this.options.mergeUndefined) {
                                    continue;
                                }
                                Object.assign(target, { [key]: source[key] });
                            }
                        }
                    }
                }
            }
        }
        return target;
    }
}

const defaultMerge = Merger.build();
const arrayMerger = Merger.build({ mergeArrays: true });
const mergeDropUndefinedMerger = Merger.build({ mergeUndefined: false });

/**
 * Like Object.assign but will do a deep merge
 * @param target where all sources will be merged
 * @param sources what to merge into target, one or multiple
 * @returns
 */
export const merge = defaultMerge.merge.bind(defaultMerge);

/**
 * Like Object.assign but will do a deep merge and will concat arrays instead of replacing them
 * @param target where all sources will be merged
 * @param sources what to merge into target, one or multiple
 * @returns
 */
export const mergeConcatArrays = arrayMerger.merge.bind(arrayMerger);

/**
 * Like Object.assign but will do a deep merge and will ignore undefined values in sources
 * @param target where all sources will be merged
 * @param sources what to merge into target, one or multiple
 * @returns
 */
export const mergeDropUndefined = mergeDropUndefinedMerger.merge.bind(mergeDropUndefinedMerger);
