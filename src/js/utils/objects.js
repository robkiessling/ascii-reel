
export function isObject(val) {
    return val !== null && typeof val === 'object' && Array.isArray(val) === false;
}

/**
 * Builds a new object by transforming all the values of a given object.
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