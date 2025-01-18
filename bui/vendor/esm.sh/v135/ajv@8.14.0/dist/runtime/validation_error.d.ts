import type { ErrorObject } from "../types/index.d.ts";
export default class ValidationError extends Error {
    readonly errors: Partial<ErrorObject>[];
    readonly ajv: true;
    readonly validation: true;
    constructor(errors: Partial<ErrorObject>[]);
}
