import type { AnySchemaObject } from "./types/index.d.ts";
import AjvCore from "./core.d.ts";
export declare class Ajv extends AjvCore {
    _addVocabularies(): void;
    _addDefaultMetaSchema(): void;
    defaultMeta(): string | AnySchemaObject | undefined;
}
export default Ajv;
export { Format, FormatDefinition, AsyncFormatDefinition, KeywordDefinition, KeywordErrorDefinition, CodeKeywordDefinition, MacroKeywordDefinition, FuncKeywordDefinition, Vocabulary, Schema, SchemaObject, AnySchemaObject, AsyncSchema, AnySchema, ValidateFunction, AsyncValidateFunction, SchemaValidateFunction, ErrorObject, ErrorNoParams, } from "./types/index.d.ts";
export { Plugin, Options, CodeOptions, InstanceOptions, Logger, ErrorsTextOptions } from "./core.d.ts";
export { SchemaCxt, SchemaObjCxt } from "./compile/index.d.ts";
export { KeywordCxt } from "./compile/validate/index.d.ts";
export { DefinedError } from "./vocabularies/errors.d.ts";
export { JSONType } from "./compile/rules.d.ts";
export { JSONSchemaType } from "./types/json-schema.d.ts";
export { _, str, stringify, nil, Name, Code, CodeGen, CodeGenOptions } from "./compile/codegen/index.d.ts";
export { default as ValidationError } from "./runtime/validation_error.d.ts";
export { default as MissingRefError } from "./compile/ref_error.d.ts";
