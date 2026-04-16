import { MonoTypeOperatorFunction, NextObserver, tap } from "rxjs";

export const tapSubscription =
  <T>(observer?: NextObserver<boolean>): MonoTypeOperatorFunction<T> =>
  (source) => {
    let subscriptions = 0;

    return source.pipe(
      tap({
        subscribe: () => observer?.next(++subscriptions > 0),
        unsubscribe: () => observer?.next(--subscriptions > 0),
      }),
    );
  };
