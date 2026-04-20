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
import { AsyncObservable, ProxyObservable } from "./observable";
import { concat } from "./operators";

export interface Effect<Args, Result> extends UnaryFunction<
  Args,
  Observable<Result>
> {}

export interface AsyncEffect<Args, Result> extends UnaryFunction<
  Args,
  AsyncObservable<Result>
> {}

export type AsyncEffects<Effects extends Dictionary<AsyncEffect<any, any>>> = {
  [K in keyof Effects]: ReturnType<
    <
      Args extends Effects[K] extends AsyncEffect<infer Args, infer _>
        ? Args
        : never,
      Result extends Effects[K] extends AsyncEffect<infer _, infer Result>
        ? Result
        : never,
    >() => AsyncEffect<Args, Result>
  >;
};

export class AsyncEffectInterceptor extends ReplaySubject<
  AsyncObservable<any>
> {
  intercept<Effects extends Dictionary<AsyncEffect<any, any>>>(
    effects: Effects,
  ): AsyncEffects<Effects> {
    return mapValues(
      effects,
      (effect) => (args) => tap(effect(args), (source) => this.next(source)),
    );
  }

  toAsyncEffect<Args, Result>(
    effect: Effect<Args, Result>,
  ): AsyncEffect<Args, Result> {
    return (args) =>
      new (class
        extends ProxyObservable<Result>
        implements AsyncObservable<Result>
      {
        pending: Observable<boolean>;

        constructor(interceptor: AsyncEffectInterceptor) {
          super(effect(args), identity);

          this.pending = interceptor.pipe(
            distinct(),
            concat(),
            switchMap((sources) =>
              combineLatest(sources.map((source) => source.pending)),
            ),
            map((values) => values.some(Boolean)),
          );
        }
      })(this);
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
