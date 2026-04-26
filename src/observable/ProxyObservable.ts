import { tap, thru } from "lodash";
import {
  isObservable,
  map,
  Observable,
  of,
  scan,
  Subject,
  Subscriber,
  UnaryFunction,
} from "rxjs";

export interface ProxyObservableDescriptor<T, U> {
  (target: T):
    | U
    | {
        value: U;
        pending?: Observable<boolean>;
      };
}

export class ProxyObservable<
  X,
  Y = X,
  T extends Observable<X> = Observable<X>,
> extends Observable<Y> {
  pending: Observable<boolean>;
  refCount: Observable<number>;

  constructor(
    target: T,
    descriptor: ProxyObservableDescriptor<T, Observable<Y>>,
  ) {
    const { value, pending = of(false) } = thru(
      descriptor(target),
      (descriptor) =>
        isObservable(descriptor) ? { value: descriptor } : descriptor,
    );

    const subscribers = new Subject<UnaryFunction<Set<Subscriber<Y>>, void>>();

    super((subscriber) => {
      subscribers.next((subscribers) => subscribers.add(subscriber));

      subscriber.add(() =>
        subscribers.next((subscribers) => subscribers.delete(subscriber)),
      );

      return value.subscribe(subscriber);
    });

    this.pending = pending;
    this.refCount = subscribers.pipe(
      scan(tap, new Set<Subscriber<Y>>()),
      map((subscribers) => subscribers.size),
    );
  }
}
