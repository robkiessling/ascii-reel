import CellArea from "../../geometry/cell_area.js";


export default class VectorMarquee {

    constructor(canvasControl, startX, startY, onUpdate) {
        this.canvasControl = canvasControl;
        this.startX = startX;
        this.startY = startY;
        this.onUpdate = onUpdate;
    }

    update(endX, endY) {
        this.endX = endX;
        this.endY = endY;

        this.onUpdate(this.boundingArea);
    }

    get xywh() {
        const x = Math.min(this.startX, this.endX);
        const y = Math.min(this.startY, this.endY);
        const width = Math.abs(this.startX - this.endX);
        const height = Math.abs(this.startY - this.endY);
        return [x, y, width, height];
    }

    get boundingArea() {
        const [x, y, width, height] = this.xywh;
        const topLeft = this.canvasControl.cellAtScreenXY(x, y);
        const bottomRight = this.canvasControl.cellAtScreenXY(x + width, y + height);
        return new CellArea(topLeft, bottomRight);
    }

}