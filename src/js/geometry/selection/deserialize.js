/**
 * Shape deserialization module
 *
 * This module turns plain serialized selection shape data back into instantiated SelectionShape subclasses.
 *
 * It exists separately from shape.js to avoid circular dependencies: the base shape.js class cannot import
 * these subclasses because the subclasses already import the base shape.js class.
 */
import {SELECTION_SHAPE_TYPES} from "./constants.js";
import LineSelection from "./line.js";
import RectSelection from "./rect.js";
import TextSelection from "./text.js";
import LassoSelection from "./lasso.js";
import WandSelection from "./wand.js";

export function deserializeSelectionShape(data) {
    switch (data.type) {
        case SELECTION_SHAPE_TYPES.LINE:
            return LineSelection.deserialize(data);
        case SELECTION_SHAPE_TYPES.RECT:
            return RectSelection.deserialize(data);
        case SELECTION_SHAPE_TYPES.TEXT:
            return TextSelection.deserialize(data);
        case SELECTION_SHAPE_TYPES.LASSO:
            return LassoSelection.deserialize(data);
        case SELECTION_SHAPE_TYPES.WAND:
            return WandSelection.deserialize(data);
        default:
            throw new Error(`Unsupported shape type ${data.type}`);
    }
}