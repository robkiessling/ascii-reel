import RasterCel from "./raster.js";
import VectorCel from "./vector.js";
import {LAYER_TYPES} from "../../constants.js";

/**
 * Cel
 * -----------------
 * The term "cel" is short for "celluloid" https://en.wikipedia.org/wiki/Cel
 * In this app, it represents one image in a specific frame and layer.
 * Note: This is different from a "Cell" (which refers to a row/column pair in this app)
 */
export default class CelFactory {

    static blank(layerType) {
        switch(layerType) {
            case LAYER_TYPES.RASTER:
                return RasterCel.blank();
            case LAYER_TYPES.VECTOR:
                return VectorCel.blank();
            default:
                throw new Error(`Invalid layerType '${layerType}'`)
        }
    }

    static deserialize(celData, options) {
        switch(celData.layerType) {
            case LAYER_TYPES.RASTER:
                return RasterCel.deserialize(celData, options);
            case LAYER_TYPES.VECTOR:
                return VectorCel.deserialize(celData, options);
            default:
                throw new Error(`Invalid layerType '${celData.layerType}' in ${celData}`)
        }
    }

}

