import { constant } from "lodash";
import {
  BehaviorSubject,
  defer,
  finalize,
  isObservable,
  Observable,
  UnaryFunction,
} from "rxjs";
import { ProxyObservable } from "./ProxyObservable";

export interface AsyncObservable<T> {
  pending: Observable<boolean>;
}

export class AsyncObservable<T> extends ProxyObservable<T> {
  constructor(
    source: Observable<T> | UnaryFunction<() => void, Observable<T>>,
  ) {
    const pending = new BehaviorSubject(false);
    const complete = () => pending.next(false);

    if (isObservable(source)) {
      source = constant(source);
    }

    super(source(complete), (source) =>
      defer(() => (pending.next(true), source)).pipe(finalize(complete)),
    );

    this.pending = pending;
  }
}
