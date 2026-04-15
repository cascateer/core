import { once } from "lodash";
import {
  BehaviorSubject,
  combineLatest,
  map,
  MonoTypeOperatorFunction,
  Observable,
} from "rxjs";
import { tapSubscription } from "../operators";

export interface TapObservable<T> extends Observable<T> {
  loading: Observable<boolean>;
}

export class TapObservable<T> extends Observable<T> {
  constructor(source: Observable<T>, loading: Observable<boolean>) {
    const subscribed = new BehaviorSubject(false);

    const intercept: MonoTypeOperatorFunction<T> = once((source) =>
      source.pipe(tapSubscription(subscribed)),
    );

    super((subscriber) => source.pipe(intercept).subscribe(subscriber));

    this.loading = combineLatest([loading, subscribed]).pipe(
      map((values) => values.every(Boolean)),
    );
  }
}
