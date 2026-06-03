import { Dictionary, mapValues, tap } from "lodash";
import { combineLatest, ReplaySubject, switchMap, UnaryFunction } from "rxjs";
import { Observable } from "rxjs/internal/Observable";
import { ObservableInput } from "rxjs/internal/types";
import { memoizeHashed } from "./lib/memoizeHashed";
import { ProxyObservable } from "./observable";
import { accumulate, every, some } from "./operators";

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
    return mapValues(effects, (effect) =>
      memoizeHashed((args) =>
        tap(
          new ProxyObservable(effect(args), (target, receiver) =>
            combineLatest([target.pending, receiver.refCount]).pipe(every()),
          ),
          (source) => this.next(source),
        ),
      ),
    );
  }

  proxy<Args, Result>(effect: Effect<Args, Result>): ProxyEffect<Args, Result> {
    return (args) =>
      new ProxyObservable(effect(args), () =>
        this.pipe(
          accumulate(),
          switchMap((sources) =>
            combineLatest(sources.map((source) => source.pending)),
          ),
          some(),
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
