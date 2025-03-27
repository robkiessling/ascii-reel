
export function isObject(val) {
    return val !== null && typeof val === 'object' && Array.isArray(val) === false;
}

/**
 * Builds a new object by transforming all the values of a given object.
 * @param obj
 * @param {function(key:string, value:*):*} transformer Function that modifies the values. Is provided the key and the
 *   value of the original object, is expected to return the transformed value to store in the new object.
 * @returns {Object}
 */
export function transformValues(obj, transformer) {
    return Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [k, transformer(k, v)])
    )
}