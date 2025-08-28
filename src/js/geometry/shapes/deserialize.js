/**
 * Shape deserialization module
 *
 * This module turns plain serialized shape data back into instantiated Shape subclasses.
 *
 * It exists separately from shape.js to avoid circular dependencies: the base shape.js class cannot import
 * these Shape subclasses because the subclasses already import the base shape.js class.
 */

import {SHAPE_TYPES} from "./constants.js";
import Rect from "./rect.js";
import Ellipse from "./ellipse.js";
import Line from "./line.js";

export function deserializeShape(data) {
    switch (data.type) {
        case SHAPE_TYPES.RECT:
            return new Rect(data.id, data.type, Rect.deserializeProps(data.props));
        case SHAPE_TYPES.ELLIPSE:
            return new Ellipse(data.id, data.type, Ellipse.deserializeProps(data.props));
        case SHAPE_TYPES.LINE:
            return new Line(data.id, data.type, Line.deserializeProps(data.props));
        default:
            throw new Error(`Unsupported shape type ${data.type}`);
    }
}