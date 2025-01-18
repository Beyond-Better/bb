import type { CodeKeywordDefinition, ErrorObject } from "../../types/index.d.ts";
export type FormatError = ErrorObject<"format", {
    format: string;
}, string | {
    $data: string;
}>;
declare const def: CodeKeywordDefinition;
export default def;
