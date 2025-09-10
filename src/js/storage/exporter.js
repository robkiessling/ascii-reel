import Color from "@sphinxxxx/color-conversion";
import * as state from "../state/index.js";
import {exportFile} from "./file_system.js";
import {importAnimated_GIF, importJSZip} from "../utils/lazy_loaders.js";
import {fontRatio} from "../config/font.js";
import Canvas from "../components/canvas.js";
import {defer, setIntervalUsingRAF} from "../utils/utilities.js";
import {hideFullScreenLoader, showFullScreenLoader} from "../utils/overlays.js";


/**
 * Exports the ASCII animation into a variety of formats.
 * @param {Object} options - Object containing various export options. Must contain a key `format` with one of the allowed
 *   export formats. For further options, see the export functions below (e.g. for format:json, look at exportJson).
 * @param {boolean} [exportToActiveFile] - If true, will re-export to the current active export file rather than prompting
 *   the user for a new save location.
 * @returns {Promise<string>} - Returns the name of the saved export file (will be undefined if File System API not supported).
 */
export async function exportAnimation(options, exportToActiveFile) {
    state.vacuumColorTable(); // We embed the colorTable into some formats; this ensures it is as small as possible

    let filename;

    switch(options.format) {
        case 'json':
            filename = await exportJson(options, exportToActiveFile);
            break;
        case 'png':
            filename = await exportPng(options, exportToActiveFile);
            break;
        case 'txt':
            filename = await exportTxt(options, exportToActiveFile);
            break;
        case 'rtf':
            filename = await exportRtf(options, exportToActiveFile);
            break;
        case 'html':
            filename = await exportHtml(options, exportToActiveFile);
            break;
        case 'gif':
            filename = await exportGif(options, exportToActiveFile);
            break;
        case 'webm':
            filename = await exportWebm(options, exportToActiveFile);
            break;
        default:
            throw new Error(`Invalid export format format ${options.format}`);
    }

    state.setConfig('lastExportOptions', options);

    return filename;
}



// --------------------------------------------------------------------------------- json

async function exportJson(options = {}, exportToActiveFile) {
    const encodeColor = (colorStr) => {
        const color = new Color(colorStr);
        switch (options.colorFormat) {
            case 'hex-str':
                return color.hex
            case 'rgba-str':
                return color.rgbaString
            case 'rgba-array':
                return color.rgba
            default:
                return null
        }
    }

    const blobPromise = lazyBlobPromise(async () => {
        const jsonData = {
            width: state.numCols(),
            height: state.numRows(),
            fps: state.getConfig('fps'),
            background: state.getConfig('background') ? encodeColor(state.getConfig('background')) : null,
            frames: []
        }

        state.expandedFrames().forEach((frame, i) => {
            const glyphs = state.layeredGlyphs(frame, { convertEmptyStrToSpace: true });
            let jsonFrame;
            switch (options.frameStructure) {
                case 'array-chars':
                    jsonFrame = glyphs.chars;
                    if (options.mergeCharRows) jsonFrame = jsonFrame.map(row => row.join(''));
                    break;
                case 'obj-chars':
                    jsonFrame = { chars: glyphs.chars };
                    if (options.mergeCharRows) jsonFrame.chars = jsonFrame.chars.map(row => row.join(''));
                    break;
                case 'obj-chars-colors':
                    jsonFrame = { chars: glyphs.chars, colors: glyphs.colors };
                    if (options.mergeCharRows) jsonFrame.chars = jsonFrame.chars.map(row => row.join(''));
                    jsonFrame.colors = jsonFrame.colors.map(row => row.map(colorIndex => {
                        return encodeColor(state.colorStr(colorIndex))
                    }));
                    break;
                case 'obj-chars-colors-colorTable':
                    jsonFrame = { chars: glyphs.chars, colors: glyphs.colors };
                    if (options.mergeCharRows) jsonFrame.chars = jsonFrame.chars.map(row => row.join(''));
                    jsonData.colorTable = state.colorTable().map(colorStr => encodeColor(colorStr))
                    break;
            }
            jsonData.frames.push(jsonFrame);
        });

        return new Blob([JSON.stringify(jsonData)], { type: "application/json" });
    })

    return await exportFile(blobPromise, 'json', 'application/json', exportToActiveFile)
}





// --------------------------------------------------------------------------------- txt

/**
 * options:
 *  - frames: ['current', 'zip', 'spritesheet']
 *  - frameSeparator: (only applicable if frames:spritesheet) characters to separate frames with
 */
async function exportTxt(options = {}, exportToActiveFile) {
    let blobPromise;

    switch(options.frames) {
        case 'current':
            blobPromise = lazyBlobPromise(async () => {
                const txtContent = frameToTxt(state.currentFrame(), options);
                return new Blob([txtContent], {type: "text/plain"});
            })
            return await exportFile(blobPromise, 'txt', 'text/plain', exportToActiveFile)
        case 'spritesheet':
            blobPromise = lazyBlobPromise(async () => {
                let txtContent = '';
                for (const [index, frame] of state.expandedFrames().entries()) {
                    txtContent += buildFrameSeparator(options, index, '\n');
                    txtContent += frameToTxt(frame, options);
                }
                return new Blob([txtContent], {type: "text/plain"});
            })
            return await exportFile(blobPromise, 'txt', 'text/plain', exportToActiveFile)
        case 'zip':
            blobPromise = lazyBlobPromise(async () => {
                const JSZip = await importJSZip();
                const zip = new JSZip();

                for (const [index, frame] of state.expandedFrames().entries()) {
                    zip.file(`${index}.txt`, frameToTxt(frame, options));
                }
                return zip.generateAsync({type:"blob"});
            });
            return await exportFile(blobPromise, 'zip', 'application/zip', exportToActiveFile);
        default:
            console.error(`Invalid options.frames: ${options.frames}`);
    }
}

function frameToTxt(frame, options) {
    return exportableFrameString(frame, '\n');
}



// --------------------------------------------------------------------------------- rtf

/**
 * options:
 *  - fontSize: font size
 *  - frames: ['current', 'zip', 'spritesheet']
 *  - frameSeparator: (only applicable if frames:spritesheet) character to separate frames with
 *
 * For more information on RTF format: https://www.oreilly.com/library/view/rtf-pocket-guide/9781449302047/ch01.html
 */
async function exportRtf(options, exportToActiveFile) {
    let blobPromise;

    switch(options.frames) {
        case 'current':
            blobPromise = lazyBlobPromise(async () => {
                const rtfFrame = frameToRtf(state.currentFrame(), options);
                const rtfFile = buildRtfFile(rtfFrame, options);
                return new Blob([rtfFile], {type: "application/rtf"});
            });
            return await exportFile(blobPromise, 'rtf', 'application/rtf', exportToActiveFile);
        case 'spritesheet':
            blobPromise = lazyBlobPromise(async () => {
                let rtfContent = '';
                for (const [index, frame] of state.expandedFrames().entries()) {
                    rtfContent += `{\\cf0 ${buildFrameSeparator(options, index, '\\line ')}}`; // use index 0 of color table
                    rtfContent += frameToRtf(frame, options);
                }
                const rtfFile = buildRtfFile(rtfContent, options);
                return new Blob([rtfFile], {type: "application/rtf"});
            });
            return await exportFile(blobPromise, 'rtf', 'application/rtf', exportToActiveFile);
        case 'zip':
            blobPromise = lazyBlobPromise(async () => {
                const JSZip = await importJSZip();
                const zip = new JSZip();

                for (const [index, frame] of state.expandedFrames().entries()) {
                    const rtfFrame = frameToRtf(frame, options);
                    const rtfFile = buildRtfFile(rtfFrame, options);
                    zip.file(`${index}.rtf`, rtfFile);
                }
                return zip.generateAsync({type:"blob"});
            });
            return await exportFile(blobPromise, 'zip', 'application/zip', exportToActiveFile);
        default:
            console.error(`Invalid options.frames: ${options.frames}`);
    }
}


function buildRtfFile(content, options) {
    function _encodeRtfColor(colorStr) {
        const [r, g, b, a] = new Color(colorStr).rgba; // Break colorStr into rgba components
        return `\\red${r}\\green${g}\\blue${b}`; // Note: alpha cannot be shown in rtf
    }

    // Value fmodern tells the OS to use a monospace font in case the given font is not found
    const fontTable = `{\\fonttbl {\\f0\\fmodern ${state.getConfig('font')};}}`;

    const rtfColors = [
        // First color reserved for default color (e.g. in TextEdit will be black for light-mode, white for dark-mode)
        // Will be used by frame separators.
        '',

        // Second color reserved for background
        state.getConfig('background') ? _encodeRtfColor(state.getConfig('background')) : '',

        // Then merge in all colors used in the drawing
        ...state.colorTable().map(colorStr => _encodeRtfColor(colorStr))
    ]

    const colorTable = `{\\colortbl ${rtfColors.join(';')};}`;

    // rtf font size is in half pt, so multiply desired font size by 2
    const fontSize = options.fontSize * 2;

    return `{\\rtf1\\ansi\\deff0 ${fontTable}${colorTable}\\f0\\fs${fontSize} ${content}}`;
}

function frameToRtf(frame, options) {
    // char background: use index 1 of color table. Note: chshdng / chcbpat is for MS Word compatibility
    const charBg = options.background && state.getConfig('background') ? `\\chshdng0\\chcbpat${1}\\cb${1}` : '';

    return exportableFrameString(frame, '\\line ', line => {
        // The first replace handles special RTF chars: { } \
        // The next 3 replace calls handle escaping unicode chars (see oreilly doc above for more info)
        const escapedText = line.text
            .replace(/[{}\\]/g, match => "\\" + match) // Escape special RTF chars: { } \
            .replace(/[\u0080-\u00FF]/g, match => `\\'${match.charCodeAt(0).toString(16)}`)
            .replace(/[\u0100-\u7FFF]/g, match => `\\uc1\\u${match.charCodeAt(0)}*`)
            .replace(/[\u8000-\uFFFF]/g, match => `\\uc1\\u${match.charCodeAt(0)-0xFFFF}*`)

        // For foreground color, add 2 to colorIndex since we prepended 2 colors to the color table
        const colorTableIndex = state.isMultiColored() ? line.colorIndex + 2 : 0;
        
        return `{\\cf${colorTableIndex}${charBg} ${escapedText}}`;
    })
}



// --------------------------------------------------------------------------------- html

/**
 * options:
 *  - fontSize: font size
 *  - fps: frames per second
 *  - background: (boolean) whether to include background or not TODO
 *  - loop: (boolean) whether to loop the animation continuously
 */
async function exportHtml(options, exportToActiveFile) {
    const blobPromise = lazyBlobPromise(async () => {
        const frames = state.expandedFrames().map(frame => {
            return exportableFrameString(frame, '<br>', line => `<span style="color:${state.colorStr(line.colorIndex)};">${line.text}</span>`)
        });

        // <script> that will animate the <pre> contents
        const script = `
            document.addEventListener("DOMContentLoaded", function() {
                var sprite = document.getElementById('sprite');
                var frames = ${JSON.stringify(frames)};
                var fps = ${frames.length > 1 ? options.fps : 0};
                var loop = ${options.loop};
                var frameIndex = 0;
    
                function draw() {
                    sprite.innerHTML = frames[frameIndex];
                    frameIndex++;
                    if (frameIndex >= frames.length) frameIndex = 0;
                    if (fps !== 0 && (loop || frameIndex !== 0)) setTimeout(draw, 1000 / fps); 
                }
                
                draw();
            });
        `;

        const width = state.numCols() * options.fontSize * fontRatio;
        const background = options.background && state.getConfig('background') ? `background: ${state.getConfig('background')};` : '';
        const fontStyles = `font-family: ${state.fontFamily()};font-size: ${options.fontSize}px;`;

        const body = `<pre id="sprite" style="width:${width}px;${background};${fontStyles}"></pre>`;
        const html = createHTMLFile(state.getName(), script, body);
        return new Blob([html], {type: "text/html"});
    });

    return await exportFile(blobPromise, 'html', 'text/html', exportToActiveFile);
}

// Note: Indentation is purposely left-aligned since it gets put exactly as is into HTML file
function createHTMLFile(title, script, body) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <script>${script}</script>
</head>
<body>
    ${body}
</body>
</html>`;
}

// --------------------------------------------------------------------------------- png

/**
 * options:
 *  - width: width of result
 *  - height: height of result
 *  - frames: ['current', 'zip', 'spritesheet']
 *  - spritesheetColumns: # of columns in the spritesheet todo
 *  - spritesheetRows: # of rows in the spritesheet todo
 */
async function exportPng(options, exportToActiveFile) {
    setupExportCanvas(options);
    let blobPromise;

    switch(options.frames) {
        case 'current':
            blobPromise = lazyBlobPromise(() => {
                renderExportFrame(state.currentFrame(), options);
                return canvasToBlob(exportCanvas.canvas);
            })
            return await exportFile(blobPromise, 'png', 'image/png', exportToActiveFile);
        case 'spritesheet':
            // TODO implement this
            console.error('not yet implemented');
            break;
        case 'zip':
            blobPromise = lazyBlobPromise(async () => {
                const JSZip = await importJSZip();
                const zip = new JSZip();

                for (const [index, frame] of state.expandedFrames().entries()) {
                    renderExportFrame(frame, options);
                    zip.file(`${index}.png`, canvasToBlob(exportCanvas.canvas));
                }

                return zip.generateAsync({type:"blob"});
            })
            return await exportFile(blobPromise, 'zip', 'application/zip', exportToActiveFile);
        default:
            console.error(`Invalid options.frames: ${options.frames}`);
    }
}

// --------------------------------------------------------------------------------- gif

/**
 * options:
 *  - width: width of result
 *  - height: height of result
 *  - fps: frames per second
 *  - background: (boolean) whether to include background or not
 */
async function exportGif(options, exportToActiveFile) {
    let animatedGif;

    try {
        setupExportCanvas(options);

        const blobPromise = lazyBlobPromise(async () => {
            const Animated_GIF = await importAnimated_GIF();

            animatedGif = new Animated_GIF.default({
                // disposal value of 2 => Restore to background color after each frame
                // https://github.com/deanm/omggif/blob/master/omggif.js#L151
                disposal: 2,

                // All colors with alpha values less than this cutoff will be made completely transparent, all colors above the
                // cutoff will be made fully opaque (this is a gif limitation: pixels are either fully transparent or fully opaque).
                // Setting the cutoff very low so nothing really gets turned transparent; everything is made fully opaque.
                transparencyCutOff: 0.01
            })

            animatedGif.setSize(options.width, options.height);
            animatedGif.setDelay(1000 / options.fps);
            animatedGif.setRepeat(0); // loop forever

            state.expandedFrames().forEach(frame => {
                renderExportFrame(frame, options);
                animatedGif.addFrameImageData(exportCanvas.context.getImageData(0, 0, options.width, options.height));
            });

            // getBlobGIF is asynchronous but uses callback form -> converting it to a Promise
            return new Promise(resolve => animatedGif.getBlobGIF(resolve));
        })

        return await exportFile(blobPromise, 'gif', 'image/gif', exportToActiveFile, () => {
            // Showing a loader during GIF exports since it can take a long time (depending on dimensions and frame count).
            // Using this exportFile callback so that the loader doesn't appear until the user has chosen an export location.
            showFullScreenLoader("Your export is being processed...")
        });
    } finally {
        if (animatedGif) animatedGif.destroy();
        hideFullScreenLoader();
    }
}

// --------------------------------------------------------------------------------- webm

// Adapted from: https://stackoverflow.com/a/50683349
// TODO Make numLoops or videoLength options... how long should video go for?
// TODO Display some kind of status as video is recorded (however long your total video is is how long it takes to record)
async function exportWebm(options, exportToActiveFile) {
    setupExportCanvas(options);

    // We don't need to lazyBlobPromise because the majority of code in this promise is already asynchronous.
    // We also wrap all asynchronous callbacks in try/catch so that we can reject the promise correctly.
    const blobPromise = new Promise((resolve, reject) => {
        const numLoops = 1;
        const numFrames = state.expandedFrames().length;
        const videoLength = options.fps === 0 ? 1000 : numFrames / options.fps * 1000 * numLoops;

        let frameIndex = 0;
        setIntervalUsingRAF(() => {
            try {
                renderExportFrame(state.expandedFrames()[frameIndex], options);
                frameIndex = (frameIndex + 1) % numFrames;
            } catch (error) {
                reject(error);
            }
        }, 1000 / options.fps, true);

        const chunks = []; // here we will store our recorded media chunks (Blobs)
        const stream = exportCanvas.canvas.captureStream(); // grab our canvas MediaStream
        const rec = new MediaRecorder(stream); // init the recorder

        // every time the recorder has new data, we will store it in our array
        rec.ondataavailable = e => {
            try {
                chunks.push(e.data);
            } catch (error) {
                reject(error);
            }
        }

        // only when the recorder stops, we construct a complete Blob from all the chunks
        rec.onstop = e => {
            try {
                resolve(new Blob(chunks, {type: 'video/webm'}))
            } catch (error) {
                reject(error);
            }
        }

        rec.start();
        setTimeout(() => rec.stop(), videoLength);
    })

    return await exportFile(blobPromise, 'webm', 'video/webm', exportToActiveFile);
}



// --------------------------------------------------------------------------------- Helpers

/**
 * Creates a deferred Promise that resolves with a Blob generated by the provided function.
 *
 * This function defers execution of `generateBlob`, ensuring that the expensive operation does not block the main thread
 * immediately. This is required so that when we pass the Promise<Blob> to browser-fs-access's fileSave, fileSave is not
 * delayed by the potentially expensive blob generation. Any delays to its showSaveFilePicker call will cause a "must
 * be handling a user gesture" error to occur: https://developer.mozilla.org/en-US/docs/Web/Security/User_activation
 *
 * @param {function:Promise<Blob>} generateBlob - An asynchronous function that returns a Promise resolving to a Blob.
 * @returns {Promise<Blob>} - A Promise that resolves with the generated Blob.
 */
function lazyBlobPromise(generateBlob) {
    return new Promise((resolve, reject) => {
        defer(() => {
            /**
             * Note: we cannot just call `resolve(generateBlob())` here. Because this executor is running asynchronously,
             * if generateBlob throws an error it WON'T cause the promise to reject (https://stackoverflow.com/a/33446005).
             * To reject the promise on a generateBlob error we have to manually call reject.
             */
            generateBlob()
                .then(blob => resolve(blob))
                .catch(err => reject(err));
        })
    });
}


// Converts a frame to a string using the given newLineChar and (optional) lineFormatter
function exportableFrameString(frame, newLineChar, lineFormatter = function(line) { return line.text; }) {
    let image = '';

    const glyphs = state.layeredGlyphs(frame, { convertEmptyStrToSpace: true });
    let row, col, rowLength = glyphs.chars.length, colLength = glyphs.chars[0].length;

    for (row = 0; row < rowLength; row++) {
        // Convert individual chars into lines of text (of matching color), so we can draw as few <span> as possible
        let lines = [];
        let line, colorIndex;

        for (col = 0; col < colLength; col++) {
            colorIndex = glyphs.colors[row][col];

            if (line && colorIndex !== line.colorIndex) {
                // New color; have to make new line
                lines.push(line);
                line = null;
            }
            if (!line) {
                line = { colorIndex: colorIndex, text: '' }
            }
            line.text += glyphs.chars[row][col];
        }

        if (line) { lines.push(line); }

        lines.forEach(line => image += lineFormatter(line));

        image += newLineChar;
    }

    return image;
}

function buildFrameSeparator(options, index, newLineChar) {
    let char;
    let numbered = false;

    switch(options.frameSeparator) {
        case 'none':
            return '';
        case 'space':
            char = ' ';
            break;
        case 'spaceNumbered':
            char = ' ';
            numbered = true;
            break;
        case 'dash':
            char = '-';
            break;
        case 'dashNumbered':
            char = '-';
            numbered = true;
            break;
        case 'asterisk':
            char = '*';
            break;
        case 'asteriskNumbered':
            char = '*';
            numbered = true;
            break;
        default:
            console.warn(`Invalid frameSeparator: ${options.frameSeparator}`);
            return '';
    }

    return numbered ? index.toString() + char.repeat(state.numCols() - index.toString().length) + newLineChar :
        char.repeat(state.numCols()) + newLineChar;
}



const $exportCanvasContainer = $('#export-canvas-container')
const exportCanvas = new Canvas($('#export-canvas'), {
    willReadFrequently: true
});

function setupExportCanvas(options) {
    $exportCanvasContainer
        .width(options.width / window.devicePixelRatio)
        .height(options.height / window.devicePixelRatio);
    exportCanvas.resize(true);
    exportCanvas.zoomToFit();
}

function renderExportFrame(frame, options) {
    exportCanvas.clear();
    if (options.background && state.getConfig('background')) exportCanvas.drawBackground(state.getConfig('background'));
    exportCanvas.drawGlyphs(state.layeredGlyphs(frame));
}

// Converts canvas.toBlob's asynchronous callback-based function into a Promise for await support
function canvasToBlob(canvas) {
    return new Promise((resolve) => canvas.toBlob(resolve));
}


