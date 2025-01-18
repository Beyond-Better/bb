import type { KeywordErrorCxt, KeywordErrorDefinition } from "../types/index.d.ts";
import { CodeGen, Code, Name } from "./codegen/index.d.ts";
export declare const keywordError: KeywordErrorDefinition;
export declare const keyword$DataError: KeywordErrorDefinition;
export interface ErrorPaths {
    instancePath?: Code;
    schemaPath?: string;
    parentSchema?: boolean;
}
export declare function reportError(cxt: KeywordErrorCxt, error?: KeywordErrorDefinition, errorPaths?: ErrorPaths, overrideAllErrors?: boolean): void;
export declare function reportExtraError(cxt: KeywordErrorCxt, error?: KeywordErrorDefinition, errorPaths?: ErrorPaths): void;
export declare function resetErrorsCount(gen: CodeGen, errsCount: Name): void;
export declare function extendErrors({ gen, keyword, schemaValue, data, errsCount, it, }: KeywordErrorCxt): void;
