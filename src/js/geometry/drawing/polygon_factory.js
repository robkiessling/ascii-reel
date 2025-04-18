import DrawingRect from "./rect/base.js";
import AdaptiveFreeform from "./freeform/adaptive.js";
import UniformEllipse from "./ellipse/uniform.js";
import AdaptiveLine from "./line/adaptive.js";
import UniformLine from "./line/uniform.js";
import ElbowLine from "./line/elbow.js";
import UniformFreeform from "./freeform/uniform.js";

export default class PolygonFactory {

    static createFreeform(cell, options) {
        switch (options.drawType) {
            case 'ascii-generated':
                return new AdaptiveFreeform(cell, options);
            case 'current-char':
            case 'eraser':
            case 'paint-brush':
                return new UniformFreeform(cell, options);

            // TODO elbow

            default:
                console.warn(`No Freeform drawing found for: ${options.drawType}`);
        }
    }

    static createLine(cell, options) {
        switch (options.drawType) {
            case 'ascii-straight':
                return new AdaptiveLine(cell, options);
            case 'current-char-straight':
                return new UniformLine(cell, options);
            case 'ascii-right-angle-line':
            case 'ascii-right-angle-arrow':
            case 'current-char-right-angle':
                return new ElbowLine(cell, options);
            default:
                console.warn(`No Line drawing found for: ${options.drawType}`);
        }
    }

    static createRect(cell, options) {
        switch (options.drawType) {
            case 'printable-ascii-1':
            case 'printable-ascii-2':
            case 'single-line':
            case 'double-line':
            case 'current-char-outline':
            case 'current-char-filled':
                return new DrawingRect(cell, options);
            default:
                console.warn(`No Rect drawing found for: ${options.drawType}`);
        }
    }

    static createEllipse(cell, options) {
        switch (options.drawType) {
            case 'current-char-outline':
            case 'current-char-filled':
                return new UniformEllipse(cell, options);

            // TODO adaptive

            default:
                console.warn(`No Line drawing found for: ${options.drawType}`);
        }
    }

}
