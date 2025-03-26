
let loaderShownAt;

/**
 * Blocks the whole screen and shows a loader (a spinning icon) accompanied by some text.
 * @param {String} [message] The text to display
 */
export function showFullScreenLoader(message = 'Loading...') {
    loaderShownAt = Date.now();
    $('#full-screen-loader').show()
        .find('.message').html(message);
}

/**
 * Hides the full screen loader.
 * @param {Number} [minDisplayTime=500] The minimum time the loader must be displayed before closing. This is used to avoid
 *   flashing (e.g. if the loader is only shown for 10ms it will be jarring -- a minDisplayTime of 500 means that the loader
 *   will continue to be displayed for 500ms). A minDisplayTime of 0 means the loader is always immediately hidden.
 */
export function hideFullScreenLoader(minDisplayTime = 500) {
    if (!loaderShownAt) {
        // If showFullScreenLoader has not been called, cannot calculate display time
        $('#full-screen-loader').hide();
        return;
    }

    const elapsedTime = Date.now() - loaderShownAt;
    const remainingTime = minDisplayTime - elapsedTime;

    if (remainingTime > 0) {
        setTimeout(() => $('#full-screen-loader').hide(), remainingTime);
    } else {
        $('#full-screen-loader').hide();
    }

}