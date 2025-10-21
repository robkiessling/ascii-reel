/**
 * Fast membership & retrieval for a set of Cells.
 * Can also be used to store other objects values with Cells as keys.
 *
 * TODO use this in all places that currently use lookups with `${cell.row},${cell.col}` keys
 */
export default class CellCache {
    constructor() {
        this._cache = new Map();
    }

    get size() {
        return this._cache.size;
    }

    add(cell) {
        this._cache.set(this._cellKey(cell), cell);
    }

    /**
     *
     * @param {Cell} cell - Cell to use as map key
     * @param {*} value - Value to store at cell index
     */
    set(cell, value) {
        this._cache.set(this._cellKey(cell), value === undefined ? cell : value)
    }

    has(cell) {
        return this._cache.has(this._cellKey(cell))
    }

    get(cell) {
        return this._cache.get(this._cellKey(cell))
    }

    delete(cell) {
        return this._cache.delete(this._cellKey(cell))
    }
    
    clear() {
        this._cache.clear();
    }

    values() {
        return [...this._cache.values()];
    }

    _cellKey(cell) {
        return `${cell.row},${cell.col}`;
    }

}