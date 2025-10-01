
export function isObject(val) {
    return val !== null && typeof val === 'object' && Array.isArray(val) === false;
}

export function isEmptyObject(obj) {
    return Object.keys(obj).length === 0;
}

/**
 * Creates a new object by transforming all the values of a given object.
 * @param {Object} obj - The object whose values you want to transform
 * @param {(key: string, value: *) => *} transformer - Function that modifies the values. Is provided the key and the
 *   value of the original object, and is expected to return the transformed value to store in the new object.
 * @returns {Object} - The newly built object with transformed values
 */
export function transformValues(obj, transformer) {
    return Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [k, transformer(k, v)])
    )
}

/**
 * Creates a new object by transforming each key-value pair of the input object.
 *
 * @param {Object} obj - The source object to transform.
 * @param {(key: string, value: *) => [string, *]} transformer -
 *   A function that receives each key-value pair and returns a new `[key, value]` tuple.
 * @returns {Object} A new object containing the transformed entries.
 *
 * @example
 * const input = { a: 1, b: 2 };
 * const output = mapObject(input, (k, v) => [k.toUpperCase(), v * 2]);
 * // => { A: 2, B: 4 }
 */
export function transformObject(obj, transformer) {
    return Object.fromEntries(
        Object.entries(obj).map(([k, v]) => transformer(k, v))
    );
}

/**
 * Creates a new object containing only the key-value pairs from the input object
 * that pass the given condition function.
 *
 * @param {Object} obj - The source object to filter.
 * @param {(key: string, value: any) => boolean} condition - A function that determines
 *   whether a given entry should be included in the result.
 * @returns {Object} A new object with only the key-value pairs that satisfy the condition.
 */
export function filterObject(obj, condition) {
    return Object.fromEntries(
        Object.entries(obj).filter(([key, value]) => condition(key, value))
    );
}

/**
 * Creates a new object containing only the specified keys from the input object.
 *
 * @param {Object} object - The source object.
 * @param {Array<string>} keys - The keys to pick from the source.
 * @returns {Object} A new object with only the picked keys that exist in the input.
 */
export function pick(object, keys) {
    const result = {};
    if (object === null) return result;

    for (const key of keys) {
        if (key in object) {
            result[key] = object[key];
        }
    }

    return result;
}