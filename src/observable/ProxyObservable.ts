import { once } from "lodash";
import { Observable, of } from "rxjs";

export interface ProxyObservableHandler<T, R> {
  (target: Observable<T>): Observable<R>;
}

export class ProxyObservable<T, R = T> extends Observable<R> {
  pending: Observable<boolean>;

  constructor(
    target: Observable<T>,
    handler: ProxyObservableHandler<T, R>,
    pending = of(false),
  ) {
    handler = once(handler);

    super((subscriber) => handler(target).subscribe(subscriber));

    this.pending = pending;
  }
}
