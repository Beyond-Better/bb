import type { CodeKeywordDefinition, ErrorObject } from "../../types/index.d.ts";
export type RequiredError = ErrorObject<"required", {
    missingProperty: string;
}, string[] | {
    $data: string;
}>;
declare const def: CodeKeywordDefinition;
export default def;
