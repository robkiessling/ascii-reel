/**
 * Shape deserialization module
 *
 * This module turns plain serialized selection shape data back into instantiated SelectionShape subclasses.
 *
 * It exists separately from shape.js to avoid circular dependencies: the base shape.js class cannot import
 * these subclasses because the subclasses already import the base shape.js class.
 */
import {SELECTION_SHAPE_TYPES} from "./constants.js";
import SelectionLine from "./line.js";
import SelectionRect from "./rect.js";
import SelectionText from "./text.js";
import SelectionLasso from "./lasso.js";
import SelectionWand from "./wand.js";

export function deserializeSelectionShape(data) {
    switch (data.type) {
        case SELECTION_SHAPE_TYPES.LINE:
            return SelectionLine.deserialize(data);
        case SELECTION_SHAPE_TYPES.RECT:
            return SelectionRect.deserialize(data);
        case SELECTION_SHAPE_TYPES.TEXT:
            return SelectionText.deserialize(data);
        case SELECTION_SHAPE_TYPES.LASSO:
            return SelectionLasso.deserialize(data);
        case SELECTION_SHAPE_TYPES.WAND:
            return SelectionWand.deserialize(data);
        default:
            throw new Error(`Unsupported shape type ${data.type}`);
    }
}