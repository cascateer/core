import { BehaviorSubject, defer, finalize, Observable } from "rxjs";
import { ProxyObservable } from "./ProxyObservable";

export interface TapObservable<T> {
  loading: Observable<boolean>;
}

export class TapObservable<T> extends ProxyObservable<T> {
  constructor(source: Observable<T>) {
    const loading = new BehaviorSubject(false);

    super(source, (source) =>
      defer(() => (loading.next(true), source)).pipe(
        finalize(() => loading.next(false)),
      ),
    );

    this.loading = loading;
  }
}
