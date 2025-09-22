/**
 * A central registry that maps shape type strings (e.g., "rect") to their corresponding shape class constructors.
 * This prevents circular dependencies between the base Shape and its subclasses.
 */

const ShapeRegistry = new Map();

/**
 * Register a shape constructor under a type name. Called by each subclass module when it is first imported.
 *
 * @param {string} type - The shape's unique identifier (e.g. "rect").
 * @param {Function} constructor - The class constructor for the shape.
 */
export function registerShape(type, constructor) {
    if (ShapeRegistry.has(type)) console.warn(`Shape type "${type}" is already registered. Overwriting.`);
    ShapeRegistry.set(type, constructor);
}

/**
 * Create a new shape instance from its serialized data.
 *
 * @param {{id?: string, type: string, props: {}}} data - Serialized shape data.
 * @param {string} data.type - The type identifier of the shape.
 * @returns {Shape} - A new shape instance of the correct subclass.
 */
export function deserializeShape(data) {
    const constructor = getConstructor(data.type);
    return new constructor(data.id, data.type, constructor.deserializeProps(data.props));
}

export function getConstructor(shapeType) {
    const constructor = ShapeRegistry.get(shapeType);
    if (!constructor) throw new Error(`Unknown shape type: ${shapeType}`);
    return constructor;
}