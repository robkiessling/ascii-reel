/**
 * Shape deserialization module
 *
 * This module turns plain serialized shape data back into instantiated Shape subclasses.
 *
 * It exists separately from shape.js to avoid circular dependencies: the base shape.js class cannot import
 * these Shape subclasses because the subclasses already import the base shape.js class.
 */

import {SHAPE_TYPES} from "./constants.js";
import BaseRect from "./rect/base_rect.js";
import BaseEllipse from "./ellipse/base_ellipse.js";
import Line from "./line.js";

export function deserializeShape(data) {
    switch (data.type) {
        case SHAPE_TYPES.RECT:
            return new BaseRect(data.id, data.type, BaseRect.deserializeProps(data.props));
        case SHAPE_TYPES.ELLIPSE:
            return new BaseEllipse(data.id, data.type, BaseEllipse.deserializeProps(data.props));
        case SHAPE_TYPES.LINE:
            return new Line(data.id, data.type, Line.deserializeProps(data.props));
        default:
            throw new Error(`Unsupported shape type ${data.type}`);
    }
}