import { once, tap } from "lodash";
import {
  BehaviorSubject,
  EMPTY,
  isObservable,
  map,
  merge,
  NextObserver,
  Observable,
  ReplaySubject,
  scan,
  Subscriber,
  UnaryFunction,
} from "rxjs";

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

    const pending = new BehaviorSubject(false);
    const memoizedTarget = once(() =>
      isObservable(target) ? target : target(pending),
    );

    super((subscriber) => {
      subscribers.next((subscribers) => subscribers.add(subscriber));

      subscriber.add(() =>
        subscribers.next((subscribers) => subscribers.delete(subscriber)),
      );

      return memoizedTarget().subscribe(subscriber);
    });

    console.log(handler?.call(null, memoizedTarget(), this) ?? EMPTY);

    this.pending = merge(
      pending,
      handler?.call(null, memoizedTarget(), this) ?? EMPTY,
    );

    this.refCount = subscribers.pipe(
      scan(tap, new Set<Subscriber<T>>()),
      map((subscribers) => subscribers.size),
    );
  }
}
