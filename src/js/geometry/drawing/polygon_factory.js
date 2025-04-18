import DrawingRect from "./rect/base.js";
import AdaptiveFreeform from "./freeform/adaptive.js";
import UniformEllipse from "./ellipse/uniform.js";
import AdaptiveLine from "./line/adaptive.js";
import UniformLine from "./line/uniform.js";
import ElbowLine from "./line/elbow.js";

export default class PolygonFactory {
    static create(tool, drawType, cell, options) {
        switch (tool) {
            case 'draw-freeform':
                return this.createFreeform(drawType, cell, options);
            case 'draw-line':
                return this.createLine(drawType, cell, options);
            case 'draw-rect':
                return this.createRect(drawType, cell, options);
            case 'draw-ellipse':
                return this.createEllipse(drawType, cell, options);
            default:
                console.warn(`No drawing tool found for: ${tool}`);
        }
    }

    static createFreeform(drawType, cell, options) {
        switch (drawType) {
            case 'ascii-generated':
                return new AdaptiveFreeform(cell, options);
            case 'current-char':
                // todo
            default:
                console.warn(`No Freeform drawing found for: ${drawType}`);
        }
    }

    static createLine(drawType, cell, options) {
        switch (drawType) {
            case 'ascii-straight':
                return new AdaptiveLine(cell, options);
            case 'current-char-straight':
                return new UniformLine(cell, options);
            case 'ascii-right-angle-line':
            case 'ascii-right-angle-arrow':
            case 'current-char-right-angle':
                return new ElbowLine(cell, options);
            default:
                console.warn(`No Line drawing found for: ${drawType}`);

        }
    }

    static createRect(drawType, cell, options) {
        switch (drawType) {
            case 'printable-ascii-1':
            case 'printable-ascii-2':
            case 'single-line':
            case 'double-line':
            case 'current-char-outline':
            case 'current-char-filled':
                return new DrawingRect(cell, options);
            default:
                console.warn(`No Rect drawing found for: ${drawType}`);
        }
    }

    static createEllipse(drawType, cell, options) {
        switch (drawType) {
            case 'current-char-outline':
            case 'current-char-filled':
                return new UniformEllipse(cell, options);
            default:
                console.warn(`No Line drawing found for: ${drawType}`);
        }
    }

}
