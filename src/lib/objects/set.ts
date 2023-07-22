import fp from "lodash/fp";
import {  IsEqual } from "type-fest";

import { Get } from "lib/types/utils";


/* eslint-disable ban/ban */

type Path = string | readonly string[];

/** Proxy for lodash fp `set` with better type inference. Overloaded to support both imperative and point free style.
 *
 * If an invalid path is passed, the type of the `value` parameter is `never` which should cause a type error.
 * Do **not** do an `as never` assertion to get around this, but instead make sure that the path is correct.
 *
 * Dynamic paths is supported if an array is passed as `path`.
 * If an array is passed as `path`, it needs to be `const`: `["foo", "bar"] as const`
 */
 function set<T extends object, P extends Path, V extends Get<T, P>>(
  path: P,
  value: IsEqual<Get<T, P>, unknown> extends true ? never : V
): (obj: T) => IsEqual<Get<T, P>, unknown> extends true ? unknown : T;

function set<T extends object, P extends Path, V extends Get<T, P>>(
  obj: T,
  path: P,
  value: IsEqual<Get<T, P>, unknown> extends true ? never : V
): IsEqual<Get<T, P>, unknown> extends true ? unknown : T;

function set<T extends object, P extends Path, V extends Get<T, P>>(
  ...args: [P, V] | [T, P, V]
) {
  if (args.length === 3) {
    const [obj, path, value] = args;
    return fp.set(path)(value)(obj);
  }
  const [path, value] = args;
  return fp.set(path)(value);
}

export { set }
