/**
 * Fast membership & retrieval for a set of Cells
 *
 * TODO use this in all places that currently use lookups with `${cell.row},${cell.col}` keys
 */
export default class CellCache {
    constructor() {
        this._cache = new Map();
    }

    addCell(cell) {
        this._cache.set(this._cellKey(cell), cell)
    }

    hasCell(cell) {
        return this._cache.has(this._cellKey(cell))
    }

    deleteCell(cell) {
        return this._cache.delete(this._cellKey(cell))
    }
    
    clear() {
        this._cache.clear();
    }

    cells() {
        return [...this._cache.values()];
    }

    _cellKey(cell) {
        return `${cell.row},${cell.col}`;
    }

}