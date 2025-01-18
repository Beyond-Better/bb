// deno-lint-ignore-file no-explicit-any

/**
 * @param {*} item - An item to evaluate.
 * @returns {boolean} True if the item is a plain object, false otherwise.
 */
function isObject(item: unknown): boolean {
    return typeof item === "object" && item !== null && !Array.isArray(item);
}

/**
 * Performs a simple, recursive merge of multiple objects. This merge prioritizes
 * source objects later in the argument list, overwriting values from earlier sources.
 *
 * @template T - The expected type of the objects being merged.
 * @param {...T[]} sources - An array of objects to merge.
 * @returns {T} The merged object.
 */
export function simpleMerge<T>(...sources: T[]): T {
    const result = {} as T;
    const visited = new WeakMap<object, any>();

    return simpleMergeCore(result, visited, ...sources);
}

/**
 * Internal recursive function for the simpleMerge operation.
 *
 * @template T - The expected type of the objects being merged.
 * @param {T} current - The current merged object being built.
 * @param {WeakMap<object, any>} visited - A map to track visited objects and prevent circular references.
 * @param {...T[]} sources - The remaining objects to be merged.
 * @returns {T} The updated merged object.
 */
function simpleMergeCore<T>(current: T, visited: WeakMap<object, any>, ...sources: T[]): T {
    if (!sources.length) return current;
    const source = sources.shift() as T;

    if (source === undefined || source === null) {
        return simpleMergeCore(current, visited, ...sources);
    }

    if (isObject(source)) {
        if (visited.has(source as object)) {
            return visited.get(source as object) as T;
        }

        visited.set(source as object, current as any);

        for (const key in source) {
            const sourceValue = source[key];

            if (isObject(sourceValue)) {
                (current as Record<string, any>)[key] = (current as any)[key] || {};
                (current as Record<string, any>)[key] = simpleMergeCore(
                    (current as Record<string, any>)[key] as any,
                    visited,
                    sourceValue,
                );
            } else {
                (current as Record<string, any>)[key] = sourceValue;
            }
        }
    } else {
        return source as T;
    }

    return simpleMergeCore(current, visited, ...sources);
}
