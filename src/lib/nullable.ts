import * as F from "fp-ts/function";
import { bindTo as _bindTo, flap as _flap, let as _let } from "fp-ts/Functor";
import { Applicative1 } from "fp-ts/lib/Applicative";
import { Apply1, apS as _apS } from "fp-ts/lib/Apply";
import { bind as _bind, Chain1 } from "fp-ts/lib/Chain";
import { Either } from "fp-ts/lib/Either";
import { Foldable1 } from "fp-ts/lib/Foldable";
import { Functor1 } from "fp-ts/lib/Functor";
import { Monad1 } from "fp-ts/lib/Monad";
import { not, Predicate } from "fp-ts/lib/Predicate";
import { Refinement } from "fp-ts/lib/Refinement";
import { Separated, separated } from "fp-ts/lib/Separated";
import * as O from "fp-ts/Option";

export const isDefined = <T>(thing: T): thing is NonNullable<T> =>
  thing !== undefined && thing !== null;

export const getLeft = <E, A>(ma: Either<E, A>): Nullable<E> =>
  ma._tag === "Right" ? undefined : ma.left;
export const getRight = <E, A>(ma: Either<E, A>): Nullable<A> =>
  ma._tag === "Left" ? undefined : ma.right;

export type Nullable<A> = A | undefined;
export const URI = "Nullable";
export type _URI = typeof URI;

declare module "fp-ts/HKT" {
  interface URItoKind<A> {
    readonly Nullable: Nullable<A>;
  }
}

// Typeclass instances

type Fmap = {
  <A, B>(fn: (el: A) => B): (el: A | null | undefined) => B | undefined;
  <A, B>(el: A | null | undefined, fn: (el: A) => B): B | undefined;
};

/** Turn `A | undefined | null` into `B | undefined`
 *
 * Similar to `Nullable.map` but for native nullable values
 */
const map: Fmap = <A, B>(...args: [(el: A) => B] | [A, (el: A) => B]) => {
  if (args.length === 2) {
    const [el, fn] = args;
    return isDefined(el) ? fn(el) : undefined;
  }
  const [fn] = args;
  return (el: A) => (isDefined(el) ? fn(el) : undefined);
};

const Functor: Functor1<_URI> = {
  URI,
  map,
};

const Apply: Apply1<_URI> = {
  URI,
  map: Functor.map,
  ap: (fab, fa) => (isDefined(fab) && isDefined(fa) ? fab(fa) : undefined),
};

const Applicative: Applicative1<_URI> = {
  URI,
  ap: Apply.ap,
  map: Functor.map,
  of: (a) => a,
};

const chain =
  <A, B>(f: (a: A) => Nullable<B>) =>
  (fa: Nullable<A>): Nullable<B> =>
    isDefined(fa) ? f(fa) : undefined;
export const _chain: Chain1<_URI>["chain"] = (fa, f) => F.pipe(fa, chain(f));

const Chain: Chain1<_URI> = {
  URI,
  map: Functor.map,
  ap: Apply.ap,
  chain: _chain,
};

const Monad: Monad1<_URI> = {
  URI,
  map: Functor.map,
  ap: Apply.ap,
  chain: Chain.chain,
  of: Applicative.of,
};

const Foldable: Foldable1<_URI> = {
  URI,
  foldMap: (M) => (fa, f) => !isDefined(fa) ? M.empty : f(fa),
  reduce: (fa, b, f) => (!isDefined(fa) ? b : f(b, fa)),
  reduceRight: (fa, b, f) => (!isDefined(fa) ? b : f(fa, b)),
};

// Utils

const filter: {
  <A, B extends A>(refinement: Refinement<A, B>): (
    fa: Nullable<A>
  ) => Nullable<B>;
  <A>(predicate: Predicate<A>): <B extends A>(fb: Nullable<B>) => Nullable<B>;
  <A>(predicate: Predicate<A>): (fa: Nullable<A>) => Nullable<A>;
  <A>(fa: Nullable<A>, predicate: Predicate<A>): Nullable<A>;
} = <A, B extends A>(
  ...args:
    | [fa: Nullable<A>, predicate: Predicate<A>]
    | [Predicate<A>]
    | [Refinement<A, B>]
) => {
  if (args.length === 2) {
    const [fa, predicate] = args;
    return !isDefined(fa) ? undefined : predicate(fa) ? fa : undefined;
  }

  const [pred] = args;
  return (fa: Nullable<A>) =>
    !isDefined(fa) ? undefined : pred(fa) ? fa : undefined;
};

const separate: <A, B>(
  ma: Nullable<Either<A, B>>
) => Separated<Nullable<A>, Nullable<B>> = (ma) =>
  !isDefined(ma)
    ? separated(undefined, undefined)
    : separated(getLeft(ma), getRight(ma));

const partition: {
  <A, B extends A>(refinement: Refinement<A, B>): (
    fa: Nullable<A>
  ) => Separated<Nullable<A>, Nullable<B>>;
  <A>(predicate: Predicate<A>): <B extends A>(
    fb: Nullable<B>
  ) => Separated<Nullable<B>, Nullable<B>>;
  <A>(predicate: Predicate<A>): (
    fa: Nullable<A>
  ) => Separated<Nullable<A>, Nullable<A>>;
} =
  <A>(predicate: Predicate<A>) =>
  (fa: Nullable<A>) =>
    separated(
      F.pipe(fa, filter(not(predicate))),
      F.pipe(fa, filter(predicate))
    );

const partitionMap: <A, B, C>(
  f: (a: A) => Either<B, C>
) => (fa: Nullable<A>) => Separated<Nullable<B>, Nullable<C>> = (f) =>
  F.flow(map(f), separate);

const match =
  <A, B, C>(onNull: C, onSomething: (a: A) => B) =>
  (fa: Nullable<A>) =>
    isDefined(fa) ? onSomething(fa) : onNull;

function getOrElse<A>(fa: Nullable<A>, onNull: A): A;
function getOrElse<A>(onNull: A): (fa: Nullable<A>) => A;
function getOrElse<A>(...args: any[]) {
  if (args.length === 2) {
    const [fa, onNull] = args;
    return fa ?? onNull;
  }

  const [onNull] = args;
  return (fa: Nullable<A>) => fa ?? onNull;
}

const getOrElseW =
  <A, B>(onNull: B) =>
  (fa: Nullable<A>) =>
    fa ?? onNull;

const defaultTo = getOrElse;

export function fromPredicate<A>(a: A, predicate: Predicate<A>): Nullable<A>;
export function fromPredicate<A, B extends A>(
  b: B,
  predicate: Predicate<A>
): Nullable<B>;
export function fromPredicate<A, B extends A>(
  a: A,
  refinement: Refinement<A, B>
): Nullable<B>;
export function fromPredicate<A>(
  predicate: Predicate<A>
): (a: A) => Nullable<A>;
export function fromPredicate<A>(
  predicate: Predicate<A>
): <B extends A>(b: B) => Nullable<B>;
export function fromPredicate<A, B extends A>(
  refinement: Refinement<A, B>
): (a: A) => Nullable<B>;
export function fromPredicate(...args: any[]) {
  if (args.length === 1) {
    const [f] = args;
    return F.flow(O.fromPredicate(f), O.toUndefined);
  }
  const [a, f] = args;
  return F.pipe(a, O.fromPredicate(f), O.toUndefined);
}

// Do notation

const Do: Nullable<object> = {};

const let_ = _let(Functor);
const bindTo = _bindTo(Functor);
const bind = _bind(Chain);
const apS = _apS(Apply);
const flap = _flap(Functor);
export {
  Functor,
  Apply,
  Chain,
  Applicative,
  Monad,
  Foldable,
  map,
  chain,
  filter,
  partition,
  separate,
  partitionMap,
  match,
  getOrElse,
  getOrElseW,
  defaultTo,
  Do,
  let_ as let,
  bindTo,
  bind,
  apS,
  flap,
};
