import RasterCel from "./raster.js";

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
            case 'raster':
                return RasterCel.blank();
            case 'vector':
                return VectorCel.blank();
            default:
                throw `Invalid layerType '${layerType}'`
        }
    }

    static deserialize(celData, options) {
        switch(celData.layerType) {
            case 'raster':
                return RasterCel.deserialize(celData, options);
            case 'vector':
                return VectorCel.deserialize(celData, options);
            default:
                throw `Invalid layerType '${celData.layerType}' in ${celData}`
        }
    }

}

