/**
 * Shape deserialization module
 *
 * This module turns plain serialized shape data back into instantiated Shape subclasses.
 *
 * It exists separately from shape.js to avoid circular dependencies: the base shape.js class cannot import
 * these Shape subclasses because the subclasses already import the base shape.js class.
 */

import {SHAPES} from "./constants.js";
import BaseRect from "./rect/base.js";

export function deserializeShape(data) {
    switch (data.type) {
        case SHAPES.RECT:
            return new BaseRect(data.id, data.type, BaseRect.deserializeProps(data.props));
        default:
            throw new Error(`Unsupported shape type ${data.type}`);
    }
}