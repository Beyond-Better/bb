import type { ErrorObject, Vocabulary } from "../../types/index.d.ts";
import { LimitNumberError } from "./limitNumber.d.ts";
import { MultipleOfError } from "./multipleOf.d.ts";
import { PatternError } from "./pattern.d.ts";
import { RequiredError } from "./required.d.ts";
import { UniqueItemsError } from "./uniqueItems.d.ts";
import { ConstError } from "./const.d.ts";
import { EnumError } from "./enum.d.ts";
declare const validation: Vocabulary;
export default validation;
type LimitError = ErrorObject<"maxItems" | "minItems" | "minProperties" | "maxProperties" | "minLength" | "maxLength", {
    limit: number;
}, number | {
    $data: string;
}>;
export type ValidationKeywordError = LimitError | LimitNumberError | MultipleOfError | PatternError | RequiredError | UniqueItemsError | ConstError | EnumError;
