import type { CodeKeywordDefinition, ErrorObject, AnySchema } from "../../types/index.d.ts";
import type { KeywordCxt } from "../../compile/validate/index.d.ts";
export type AdditionalItemsError = ErrorObject<"additionalItems", {
    limit: number;
}, AnySchema>;
declare const def: CodeKeywordDefinition;
export declare function validateAdditionalItems(cxt: KeywordCxt, items: AnySchema[]): void;
export default def;
