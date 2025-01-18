import type { TypeError } from "../compile/validate/dataType.d.ts";
import type { ApplicatorKeywordError } from "./applicator/index.d.ts";
import type { ValidationKeywordError } from "./validation/index.d.ts";
import type { FormatError } from "./format/format.d.ts";
import type { UnevaluatedPropertiesError } from "./unevaluated/unevaluatedProperties.d.ts";
import type { UnevaluatedItemsError } from "./unevaluated/unevaluatedItems.d.ts";
import type { DependentRequiredError } from "./validation/dependentRequired.d.ts";
import type { DiscriminatorError } from "./discriminator/index.d.ts";
export type DefinedError = TypeError | ApplicatorKeywordError | ValidationKeywordError | FormatError | UnevaluatedPropertiesError | UnevaluatedItemsError | DependentRequiredError | DiscriminatorError;
