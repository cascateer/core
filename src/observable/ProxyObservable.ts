import { once } from "lodash";
import { Observable } from "rxjs";

export interface ProxyObservableHandler<T, U> {
  (target: Observable<T>): Observable<U>;
}

export class ProxyObservable<T, U = T> extends Observable<U> {
  constructor(target: Observable<T>, handler: ProxyObservableHandler<T, U>) {
    handler = once(handler);

    super((subscriber) => handler(target).subscribe(subscriber));
  }
}
