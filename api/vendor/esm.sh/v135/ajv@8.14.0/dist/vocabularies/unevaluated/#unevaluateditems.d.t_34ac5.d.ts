import type { CodeKeywordDefinition, ErrorObject, AnySchema } from "../../types/index.d.ts";
export type UnevaluatedItemsError = ErrorObject<"unevaluatedItems", {
    limit: number;
}, AnySchema>;
declare const def: CodeKeywordDefinition;
export default def;
