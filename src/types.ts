import { property } from "@cascateer/lib";
import { ProxyObservable } from "@cascateer/lib/observable";
import { Dictionary, Function1, tap } from "lodash";
import { combineLatest, ReplaySubject, switchMap } from "rxjs";
import { Observable } from "rxjs/internal/Observable";
import { memoize } from "./lib/memoize";
import { accumulate, every, some } from "./operators";

export interface Effect<Args, Result> extends Function1<
  Args,
  Observable<Result>
> {}

export interface Action<Args, Result> extends Function1<
  Args,
  Promise<Result>
> {}

export interface ProxyEffect<Args, Result> extends Function1<
  Args,
  ProxyObservable<Result>
> {}

export type ProxyEffects<Effects extends Dictionary<ProxyEffect<any, any>>> = {
  [K in keyof Effects]: ReturnType<
    <
      Args extends (Effects[K] extends ProxyEffect<infer Args, infer _>
        ? Args
        : never),
      Result extends (Effects[K] extends ProxyEffect<infer _, infer Result>
        ? Result
        : never),
    >() => ProxyEffect<Args, Result>
  >;
};

export const combineProxyEffects = <T, Args, Result>({
  intercept,
  project,
}: {
  intercept: (
    proxy: <Args, Result>(
      effect: ProxyEffect<Args, Result>,
    ) => ProxyEffect<Args, Result>,
  ) => T;
  project: Function1<T, Effect<Args, Result>>;
}): ProxyEffect<Args, Result> => {
  const sources = new ReplaySubject<ProxyObservable<any>>();
  const effect = project(
    intercept((effect) =>
      memoize((args) =>
        tap(
          new ProxyObservable(effect(args), (target, receiver) =>
            combineLatest([target.pending, receiver.refCount]).pipe(every()),
          ),
          (source) => sources.next(source),
        ),
      ),
    ),
  );

  return (args) =>
    new ProxyObservable(effect(args), () =>
      sources.pipe(
        accumulate(),
        switchMap((sources) => combineLatest(sources.map(property("pending")))),
        some(),
      ),
    );
};
