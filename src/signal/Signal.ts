import {
  asEnumerable,
  EndoFunctionOperator,
  EnumerableItem,
  Enumerator,
  nonNullable,
  nthArg,
  property,
} from "@cascateer/lib";
import { clone, identity, isEqual, memoize } from "lodash";
import { distinctUntilChanged, map, Observable, UnaryFunction } from "rxjs";
import { ProxyObservable } from "../observable";

class SignalEnumerator<T> {
  constructor(private predicate: Enumerator<T> = nthArg(1)) {}

  findIndex = (key: PropertyKey) => (value: T) =>
    asEnumerable(value).map(this.predicate).indexOf(key);

  enumerate = (value: T) => asEnumerable(value).map(this.predicate);
}

export class Signal<D, T> extends ProxyObservable<T> {
  clone(): Signal<D, T> {
    return this;
  }

  get value(): Observable<T> {
    return this;
  }

  enumerator: SignalEnumerator<T>;
  retract: EndoFunctionOperator<T, D>;

  constructor({
    value,
    enumerator = new SignalEnumerator(),
    retract = identity,
  }: {
    value: Observable<T>;
    enumerator?: SignalEnumerator<T>;
    retract?: EndoFunctionOperator<T, D>;
  }) {
    super(value);

    this.enumerator = enumerator;
    this.retract = retract;
  }

  private map<U>(
    project: UnaryFunction<T, U>,
    retract: EndoFunctionOperator<U, T>,
    enumerate?: Enumerator<U>,
  ): Signal<D, U> {
    return new Signal({
      value: this.pipe(map(project), distinctUntilChanged()),
      enumerator: new SignalEnumerator(enumerate),
      retract: (transform) => this.retract(retract(transform)),
    });
  }

  protected property<K extends keyof T>(
    key: K,
    enumerate?: Enumerator<T[K]>,
  ): Signal<D, T[K]> {
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
  ): Signal<D, EnumerableItem<T>> {
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
  ): Signal<D, EnumerableItem<T>[K][]> {
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
    iteratee: (item: Signal<D, EnumerableItem<T>>, index: number) => U,
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

export class DerivedSignal<D, T = D> extends Signal<D, T> {
  property<K extends keyof T>(
    key: K,
    enumerate?: Enumerator<T[K]>,
  ): DerivedSignal<D, T[K]> {
    return new DerivedSignal(super.property(key, enumerate));
  }

  item(
    key: PropertyKey,
    enumerate?: Enumerator<EnumerableItem<T>>,
  ): DerivedSignal<D, EnumerableItem<T>> {
    return new DerivedSignal(super.item(key, enumerate));
  }

  collection<K extends keyof EnumerableItem<T>>(
    key: K,
  ): DerivedSignal<D, EnumerableItem<T>[K][]> {
    return new DerivedSignal(super.collection(key));
  }
}
