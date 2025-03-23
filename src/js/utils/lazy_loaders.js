/**
 * Dynamically importing large libraries that are only needed some of the time.
 * https://webpack.js.org/guides/code-splitting/#dynamic-imports
 */

/**
 * Dynamically import jszip library
 * @returns {Promise<JSZip>}
 */
export async function importJSZip() {
    return (await import("jszip")).default;
}

/**
 * Dynamically import gif-transparency library
 * @returns {Promise<Animated_GIF>}
 */
export async function importAnimated_GIF() {
    return (await import("gif-transparency")).default;
}
