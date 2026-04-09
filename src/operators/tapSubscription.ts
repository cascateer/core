import { MonoTypeOperatorFunction, NextObserver, tap } from "rxjs";

export const tapSubscription =
  <T>(observer?: NextObserver<boolean>): MonoTypeOperatorFunction<T> =>
  (source) =>
    source.pipe(
      tap({
        subscribe: () => observer?.next(true),
        unsubscribe: () => observer?.next(false),
      }),
    );
