import { once } from "lodash";
import { Observable } from "rxjs";

export interface ProxyObservableHandler<T, U> {
  (target: Observable<T>): Observable<U>;
}

export class ProxyObservable<T, U = T> extends Observable<U> {
  pending: Observable<boolean>;

  constructor(
    target: Observable<T>,
    handler: ProxyObservableHandler<T, U>,
    pending: Observable<boolean>,
  ) {
    handler = once(handler);

    super((subscriber) => handler(target).subscribe(subscriber));

    this.pending = pending;
  }
}
