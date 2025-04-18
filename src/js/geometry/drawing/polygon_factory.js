import DrawingRect from "./rect/base.js";
import AdaptiveFreeform from "./freeform/adaptive.js";
import MonocharEllipse from "./ellipse/monochar.js";
import AdaptiveLine from "./line/adaptive.js";
import MonocharLine from "./line/monochar.js";
import ElbowLine from "./line/elbow.js";
import MonocharFreeform from "./freeform/monochar.js";

export default class PolygonFactory {

    static createFreeform(cell, options) {
        switch (options.drawType) {
            case 'irregular-adaptive':
                return new AdaptiveFreeform(cell, options);
            case 'irregular-monochar':
            case 'eraser':
            case 'paint-brush':
                return new MonocharFreeform(cell, options);

            // TODO elbow

            default:
                console.warn(`No Freeform drawing found for: ${options.drawType}`);
        }
    }

    static createLine(cell, options) {
        switch (options.drawType) {
            case 'straight-adaptive':
                return new AdaptiveLine(cell, options);
            case 'straight-monochar':
                return new MonocharLine(cell, options);
            case 'elbow-line-ascii':
            case 'elbow-arrow-ascii':
            case 'elbow-line-unicode':
            case 'elbow-arrow-unicode':
            case 'elbow-line-monochar':
                return new ElbowLine(cell, options);
            default:
                console.warn(`No Line drawing found for: ${options.drawType}`);
        }
    }

    static createRect(cell, options) {
        switch (options.drawType) {
            case 'outline-ascii-1':
            case 'outline-ascii-2':
            case 'outline-unicode-1':
            case 'outline-unicode-2':
            case 'outline-monochar':
            case 'filled-monochar':
                return new DrawingRect(cell, options);
            default:
                console.warn(`No Rect drawing found for: ${options.drawType}`);
        }
    }

    static createEllipse(cell, options) {
        switch (options.drawType) {
            case 'outline-monochar':
            case 'filled-monochar':
                return new MonocharEllipse(cell, options);

            // TODO adaptive

            default:
                console.warn(`No Line drawing found for: ${options.drawType}`);
        }
    }

}
