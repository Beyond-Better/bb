import type { UriResolver } from "../types/index.d.ts";
export default class MissingRefError extends Error {
    readonly missingRef: string;
    readonly missingSchema: string;
    constructor(resolver: UriResolver, baseId: string, ref: string, msg?: string);
}
