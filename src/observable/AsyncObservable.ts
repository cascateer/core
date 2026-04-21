import { constant } from "lodash";
import {
  BehaviorSubject,
  defer,
  finalize,
  isObservable,
  Observable,
  UnaryFunction,
} from "rxjs";

export interface AsyncObservable<T> {
  pending: Observable<boolean>;
}

export class AsyncObservable<T> extends Observable<T> {
  constructor(
    source: Observable<T> | UnaryFunction<() => void, Observable<T>>,
  ) {
    const pending = new BehaviorSubject(false);
    const complete = () => pending.next(false);

    if (isObservable(source)) {
      source = constant(source);
    }

    super((subscriber) =>
      defer(() => (pending.next(true), source(complete)))
        .pipe(finalize(complete))
        .subscribe(subscriber),
    );

    this.pending = pending;
  }
}
