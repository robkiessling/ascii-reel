
export class ValidationError extends Error {
    constructor(message, field = null) {
        super(message);
        this.name = "ValidationError";
        this.field = field; // Optional: Helps pinpoint which field failed validation
    }
}
