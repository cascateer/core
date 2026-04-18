import { BehaviorSubject, defer, finalize, Observable } from "rxjs";
import { ProxyObservable } from "./ProxyObservable";

export interface AsyncObservable<T> {
  pending: Observable<boolean>;
}

export class AsyncObservable<T> extends ProxyObservable<T> {
  constructor(source: Observable<T>) {
    const pending = new BehaviorSubject(false);

    super(source, (source) =>
      defer(() => (pending.next(true), source)).pipe(
        finalize(() => pending.next(false)),
      ),
    );

    this.pending = pending;
  }
}
