import type { FormatLong } from "../../locale/types.d.ts";
type LongFormatter = (pattern: string, formatLong: FormatLong) => string;
export declare const longFormatters: Record<string, LongFormatter>;
export {};
