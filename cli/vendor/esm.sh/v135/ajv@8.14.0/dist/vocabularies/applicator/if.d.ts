import type { CodeKeywordDefinition, ErrorObject, AnySchema } from "../../types/index.d.ts";
export type IfKeywordError = ErrorObject<"if", {
    failingKeyword: string;
}, AnySchema>;
declare const def: CodeKeywordDefinition;
export default def;
