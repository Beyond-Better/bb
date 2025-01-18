import type { CodeKeywordDefinition, ErrorObject, AnySchema } from "../../types/index.d.ts";
export type ItemsError = ErrorObject<"items", {
    limit: number;
}, AnySchema>;
declare const def: CodeKeywordDefinition;
export default def;
