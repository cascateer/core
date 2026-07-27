import { property } from "@cascateer/lib";
import { Dictionary, Function1, once, tap, thru } from "lodash";
import {
  BehaviorSubject,
  combineLatest,
  isObservable,
  map,
  NextObserver,
  Observable,
  ReplaySubject,
  scan,
  Subscriber,
  switchAll,
  switchMap,
  UnaryFunction,
} from "rxjs";
import { memoize } from "../lib/memoize";
import { accumulate, every, some } from "../operators";
import { Effect } from "../types";

export class ProxyObservable<
  T,
  U extends Observable<T> = Observable<T>,
> extends Observable<T> {
  pending: Observable<boolean>;
  refCount: Observable<number>;

  constructor(
    target: U | ((pending: NextObserver<boolean>) => U),
    handler?: (target: U, receiver: ProxyObservable<T>) => Observable<boolean>,
  ) {
    const subscribers = new ReplaySubject<
      UnaryFunction<Set<Subscriber<T>>, void>
    >();

    const { target: memoizedTarget, pending } = thru(
      new BehaviorSubject(false),
      (pending) => ({
        target: once(() => (isObservable(target) ? target : target(pending))),
        pending: new BehaviorSubject<Observable<boolean>>(pending),
      }),
    );

    super((subscriber) => {
      subscribers.next((subscribers) => subscribers.add(subscriber));

      subscriber.add(() =>
        subscribers.next((subscribers) => subscribers.delete(subscriber)),
      );

      return memoizedTarget().subscribe(subscriber);
    });

    this.pending = pending.pipe(switchAll());

    this.refCount = subscribers.pipe(
      scan(tap, new Set<Subscriber<T>>()),
      map((subscribers) => subscribers.size),
    );

    if (handler != null) {
      pending.next(handler(memoizedTarget(), this));
    }
  }

  static combineEffects = <T, Args, Result>({
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
          switchMap((sources) =>
            combineLatest(sources.map(property("pending"))),
          ),
          some(),
        ),
      );
  };
}

export interface ProxyEffect<Args, Result> extends UnaryFunction<
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
