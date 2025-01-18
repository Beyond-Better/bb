import { number } from "jsr:@cliffy/flags@1.0.0-rc.7";
import { Type } from "../type.ts";
import type { ArgumentValue } from "../types.ts";

/** Number type. */
export class NumberType extends Type<number> {
  /** Parse number type. */
  public parse(type: ArgumentValue): number {
    return number(type);
  }
}
