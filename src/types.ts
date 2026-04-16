import { Dictionary, mapValues, memoize, tap } from "lodash";
import { UnaryFunction } from "rxjs";
import { Observable } from "rxjs/internal/Observable";
import { NextObserver, ObservableInput } from "rxjs/internal/types";
import { TapObservable } from "./observable";

export interface Effect<Args, Result> extends UnaryFunction<
  Args,
  Observable<Result>
> {}

export interface TapEffect<Args, Result> extends UnaryFunction<
  Args,
  TapObservable<Result>
> {}

export type TapEffects<Effects extends Dictionary<TapEffect<any, any>>> = {
  [K in keyof Effects]: ReturnType<
    <
      Args extends Effects[K] extends TapEffect<infer Args, infer _>
        ? Args
        : never,
      Result extends Effects[K] extends TapEffect<infer _, infer Result>
        ? Result
        : never,
    >() => TapEffect<Args, Result>
  >;
};

export const asTapEffects = <Effects extends Dictionary<TapEffect<any, any>>>(
  effects: Effects,
  observer?: NextObserver<TapObservable<any>>,
): TapEffects<Effects> =>
  mapValues(effects, (effect) =>
    memoize((args) => tap(effect(args), (source) => observer?.next(source))),
  );

export interface Action<Args, Result> extends UnaryFunction<
  Args,
  Promise<Result>
> {}

export type MaybeArray<T> = T | T[];

export type MaybeObservable<T> = T | Observable<T>;

export type MaybeObservableInput<T> = T | ObservableInput<T>;

export type MaybeObservableInputTuple<T> = {
  [K in keyof T]: MaybeObservableInput<T[K]>;
};

export type Transform<T> = UnaryFunction<T, T>;
