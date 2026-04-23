import { once } from "lodash";
import { Observable, of } from "rxjs";

export interface ProxyObservableHandler<T, U> {
  (target: Observable<T>): Observable<U>;
}

export class ProxyObservable<T, U = T> extends Observable<U> {
  pending: Observable<boolean>;

  constructor(
    target: Observable<T>,
    handler: ProxyObservableHandler<T, U>,
    pending = of(false),
  ) {
    handler = once(handler);

    super((subscriber) => handler(target).subscribe(subscriber));

    this.pending = pending;
  }
}
