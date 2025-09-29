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

    static deserialize(data, options) {
        switch(data.layerType) {
            case LAYER_TYPES.RASTER:
                return RasterCel.deserialize(data, options);
            case LAYER_TYPES.VECTOR:
                return VectorCel.deserialize(data, options);
            default:
                throw new Error(`Invalid layerType '${data.layerType}' in ${data}`)
        }
    }

}

