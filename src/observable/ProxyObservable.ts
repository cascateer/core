import { once, tap, thru } from "lodash";
import {
  BehaviorSubject,
  isObservable,
  map,
  NextObserver,
  Observable,
  ReplaySubject,
  scan,
  Subscriber,
  switchAll,
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
}
