import { Dictionary, mapValues, tap } from "lodash";
import {
  combineLatest,
  distinct,
  identity,
  map,
  ReplaySubject,
  switchMap,
  UnaryFunction,
} from "rxjs";
import { Observable } from "rxjs/internal/Observable";
import { ObservableInput } from "rxjs/internal/types";
import { ProxyObservable } from "./observable";
import { concat } from "./operators";

export interface Effect<Args, Result> extends UnaryFunction<
  Args,
  Observable<Result>
> {}

export interface ProxyEffect<Args, Result> extends UnaryFunction<
  Args,
  ProxyObservable<Result>
> {}

export type ProxyEffects<Effects extends Dictionary<ProxyEffect<any, any>>> = {
  [K in keyof Effects]: ReturnType<
    <
      Args extends Effects[K] extends ProxyEffect<infer Args, infer _>
        ? Args
        : never,
      Result extends Effects[K] extends ProxyEffect<infer _, infer Result>
        ? Result
        : never,
    >() => ProxyEffect<Args, Result>
  >;
};

export class ProxyEffectInterceptor extends ReplaySubject<
  ProxyObservable<any>
> {
  intercept<Effects extends Dictionary<ProxyEffect<any, any>>>(
    effects: Effects,
  ): ProxyEffects<Effects> {
    return mapValues(
      effects,
      (effect) => (args) => tap(effect(args), (source) => this.next(source)),
    );
  }

  proxy<Args, Result>(effect: Effect<Args, Result>): ProxyEffect<Args, Result> {
    return (args) =>
      new ProxyObservable(
        effect(args),
        identity,
        this.pipe(
          distinct(),
          concat(),
          switchMap((sources) =>
            combineLatest(sources.map((source) => source.pending)),
          ),
          map((values) => values.some(Boolean)),
        ),
      );
  }
}

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
