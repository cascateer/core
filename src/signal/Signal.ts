import { clone, identity, isEqual, memoize } from "lodash";
import { distinctUntilChanged, map, Observable, UnaryFunction } from "rxjs";
import {
  asEnumerable,
  EnumerableItem,
  Enumerator,
  nonNullable,
  nthArg,
  property,
} from "../lib";
import { ProxyObservable } from "../observable";
import { TransformOperator } from "../signal";

class SignalEnumerator<T> {
  constructor(private predicate: Enumerator<T> = nthArg(1)) {}

  findIndex = (key: PropertyKey) => (value: T) =>
    asEnumerable(value).map(this.predicate).indexOf(key);

  enumerate = (value: T) => asEnumerable(value).map(this.predicate);
}

export class Signal<T> extends ProxyObservable<T> {
  clone(): Signal<T> {
    return this;
  }

  get value(): Observable<T> {
    return this;
  }

  enumerator: SignalEnumerator<T>;
  pull: TransformOperator<T, unknown>;

  constructor({
    value,
    enumerator = new SignalEnumerator(),
    pull = identity,
  }: {
    value: Observable<T>;
    enumerator?: SignalEnumerator<T>;
    pull?: TransformOperator<T, unknown>;
  }) {
    super(value);

    this.enumerator = enumerator;
    this.pull = pull;
  }

  private map<U>(
    project: UnaryFunction<T, U>,
    lift: TransformOperator<U, T>,
    enumerate?: Enumerator<U>,
  ): Signal<U> {
    return new Signal({
      value: this.pipe(map(project), distinctUntilChanged()),
      enumerator: new SignalEnumerator(enumerate),
      pull: (transform) => this.pull(lift(transform)),
    });
  }

  protected property<K extends keyof T>(
    key: K,
    enumerate?: Enumerator<T[K]>,
  ): Signal<T[K]> {
    const findProperty: UnaryFunction<T, T[K]> = property(key);

    return this.map(
      findProperty,
      (transform) => (value) => {
        value = clone(value);

        value[key] = transform(findProperty(value));

        return value;
      },
      enumerate,
    );
  }

  protected item(
    key: PropertyKey,
    enumerate?: Enumerator<EnumerableItem<T>>,
  ): Signal<EnumerableItem<T>> {
    const findIndex = this.enumerator.findIndex(key);
    const findItem: UnaryFunction<T, EnumerableItem<T>> = (value) =>
      nonNullable(asEnumerable(value)[findIndex(value)]);

    return this.map(
      findItem,
      (transform) => (value) => {
        if (Array.isArray((value = clone(value)))) {
          value[findIndex(value)] = transform(findItem(value));
        }

        return value;
      },
      enumerate,
    );
  }

  protected collection<K extends keyof EnumerableItem<T>>(
    key: K,
  ): Signal<EnumerableItem<T>[K][]> {
    return this.map(
      (value) => asEnumerable(value).map(property(key)),
      (transform) => (value) => {
        if (Array.isArray((value = clone(value)))) {
          value.reduce(
            (property, item, index) => (
              (item[key] = property[index]),
              property
            ),
            transform(value.map(property(key))),
          );
        }

        return value;
      },
    );
  }

  list<U>(
    iteratee: (item: Signal<EnumerableItem<T>>, index: number) => U,
  ): Observable<U[]> {
    const memoizedIteratee = memoize<(key: PropertyKey, index: number) => U>(
      (key, index) => iteratee(this.item(key), index),
    );

    return this.pipe(
      map(this.enumerator.enumerate),
      distinctUntilChanged((previous, current) => isEqual(previous, current)),
      map((keys) => keys.map(memoizedIteratee)),
    );
  }
}

export class ComputedSignal<T> extends Signal<T> {
  property<K extends keyof T>(
    key: K,
    enumerate?: Enumerator<T[K]>,
  ): ComputedSignal<T[K]> {
    return new ComputedSignal(super.property(key, enumerate));
  }

  item(
    key: PropertyKey,
    enumerate?: Enumerator<EnumerableItem<T>>,
  ): ComputedSignal<EnumerableItem<T>> {
    return new ComputedSignal(super.item(key, enumerate));
  }

  collection<K extends keyof EnumerableItem<T>>(
    key: K,
  ): ComputedSignal<EnumerableItem<T>[K][]> {
    return new ComputedSignal(super.collection(key));
  }
}
