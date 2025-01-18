import type { AnySchema, AnySchemaObject, UriResolver } from "../types/index.d.ts";
import type Ajv from "../ajv.d.ts";
import type { URIComponents } from "https://esm.sh/v135/uri-js@4.4.1/dist/es5/uri.all.d.ts";
export type LocalRefs = {
    [Ref in string]?: AnySchemaObject;
};
export declare function inlineRef(schema: AnySchema, limit?: boolean | number): boolean;
export declare function getFullPath(resolver: UriResolver, id?: string, normalize?: boolean): string;
export declare function _getFullPath(resolver: UriResolver, p: URIComponents): string;
export declare function normalizeId(id: string | undefined): string;
export declare function resolveUrl(resolver: UriResolver, baseId: string, id: string): string;
export declare function getSchemaRefs(this: Ajv, schema: AnySchema, baseId: string): LocalRefs;
