import type { CodeKeywordDefinition, ErrorObject } from "../../types/index.d.ts";
type Kwd = "maximum" | "minimum" | "exclusiveMaximum" | "exclusiveMinimum";
type Comparison = "<=" | ">=" | "<" | ">";
export type LimitNumberError = ErrorObject<Kwd, {
    limit: number;
    comparison: Comparison;
}, number | {
    $data: string;
}>;
declare const def: CodeKeywordDefinition;
export default def;
