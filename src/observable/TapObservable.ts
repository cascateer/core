import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  map,
  Observable,
} from "rxjs";
import { tapSubscription } from "../operators";
import { ProxyObservable } from "./ProxyObservable";

export interface TapObservable<T> {
  loading: Observable<boolean>;
}

export class TapObservable<T> extends ProxyObservable<T> {
  constructor(source: Observable<T>, loading: Observable<boolean>) {
    const subscribed = new BehaviorSubject(false);

    super(source, (source) => source.pipe(tapSubscription(subscribed)));

    this.loading = combineLatest([loading, subscribed]).pipe(
      map((values) => values.every(Boolean)),
      distinctUntilChanged(),
    );
  }
}
