import { once } from "lodash";
import { identity, Observable } from "rxjs";

export interface ProxyObservableHandler<T> {
  (target: Observable<T>, receiver: Observable<T>): Observable<T>;
}

export class ProxyObservable<T> extends Observable<T> {
  constructor(
    target: Observable<T>,
    handler: ProxyObservableHandler<T> = identity,
  ) {
    handler = once(handler);

    super((subscriber) => handler(target, this).subscribe(subscriber));
  }
}
