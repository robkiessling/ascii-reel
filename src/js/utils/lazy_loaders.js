/**
 * Dynamically importing certain large libraries that are only needed some of the time
 *
 * https://webpack.js.org/guides/code-splitting/#dynamic-imports
 *
 */

/**
 * Dynamically import jszip library
 * @param {function(JSZip)} callback
 */
export function importJSZip(callback) {
    import("jszip").then(module => {
        callback(module.default)
    }).catch(err => {
        alert("Failed to load jszip library. Please try again later.");
        console.error(err);
    });
}

/**
 * Dynamically import gif-transparency library
 * @param {function(Animated_GIF)} callback
 */
export function importAnimated_GIF(callback) {
    import("gif-transparency").then(module => {
        callback(module.default)
    }).catch(err => {
        alert("Failed to load gif-transparency library. Please try again later.");
        console.error(err);
    });
}

