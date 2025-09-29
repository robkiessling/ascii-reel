
/**
 * Central import file for all shape subclasses.
 *
 * Each shape registers itself with the registry.js upon import. This file is imported once at app startup
 * to ensure all shapes are registered and available for deserialization via Shape.deserialize().
 *
 * Note: This file has side effects and is not meant to export anything.
 */

// Base class first
import './shape.js';

// Subclasses next
import './ellipse.js';
import './freeform.js';
import './line.js';
import './rect.js';
import './textbox.js';