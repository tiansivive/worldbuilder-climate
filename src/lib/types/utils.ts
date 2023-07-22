import { Get as TFGet } from "type-fest";
/** Strict proxy for `Get` from `type-fest` */
export type Get<BaseType, Path extends string | readonly string[]> = TFGet<
  BaseType,
  Path,
  { strict: true }
>;