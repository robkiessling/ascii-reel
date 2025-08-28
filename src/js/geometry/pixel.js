export default class Pixel {
    constructor(x, y) {
        this._x = x;
        this._y = y;
    }
    get x() {
        return this._x;
    }
    get y() {
        return this._y;
    }

    // Allows x/y values to be easily passed to other methods using javascript spread syntax (...)
    get xy() {
        return [this.x, this.y];
    }

}