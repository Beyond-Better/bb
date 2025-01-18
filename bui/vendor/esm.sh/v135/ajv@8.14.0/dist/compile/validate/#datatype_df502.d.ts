import type { ErrorObject, AnySchemaObject } from "../../types/index.d.ts";
import type { SchemaObjCxt } from "../index.d.ts";
import { JSONType } from "../rules.d.ts";
import { Code, Name } from "../codegen/index.d.ts";
export declare enum DataType {
    Correct = 0,
    Wrong = 1
}
export declare function getSchemaTypes(schema: AnySchemaObject): JSONType[];
export declare function getJSONTypes(ts: unknown | unknown[]): JSONType[];
export declare function coerceAndCheckDataType(it: SchemaObjCxt, types: JSONType[]): boolean;
export declare function checkDataType(dataType: JSONType, data: Name, strictNums?: boolean | "log", correct?: DataType): Code;
export declare function checkDataTypes(dataTypes: JSONType[], data: Name, strictNums?: boolean | "log", correct?: DataType): Code;
export type TypeError = ErrorObject<"type", {
    type: string;
}>;
export declare function reportTypeError(it: SchemaObjCxt): void;
