import { thru } from "lodash";
import { isObservable, Observable, of } from "rxjs";

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

  constructor(
    target: T,
    descriptor: ProxyObservableDescriptor<T, Observable<Y>>,
  ) {
    const { value, pending = of(false) } = thru(
      descriptor(target),
      (descriptor) =>
        isObservable(descriptor) ? { value: descriptor } : descriptor,
    );

    super((subscriber) => value.subscribe(subscriber));

    this.pending = pending;
  }
}
