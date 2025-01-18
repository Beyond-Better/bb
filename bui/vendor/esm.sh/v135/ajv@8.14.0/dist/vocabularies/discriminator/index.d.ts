import type { CodeKeywordDefinition } from "../../types/index.d.ts";
import { DiscrError, DiscrErrorObj } from "../discriminator/types.d.ts";
export type DiscriminatorError = DiscrErrorObj<DiscrError.Tag> | DiscrErrorObj<DiscrError.Mapping>;
declare const def: CodeKeywordDefinition;
export default def;
