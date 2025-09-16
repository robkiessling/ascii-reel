
/**
 * Checks if two sets contain the same elements (shallow comparison; objects are compared by reference)
 *
 * @param {Set} a - The first Set to compare.
 * @param {Set} b - The second Set to compare.
 * @returns {boolean} - True if both arrays contain the same elements in the same order.
 */
export function areSetsEqual(a, b) {
    if (a.size !== b.size) return false;
    for (const val of a) {
        if (!b.has(val)) return false;
    }
    return true;
}