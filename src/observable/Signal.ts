import { clone, identity, isEqual, memoize } from "lodash";
import { distinctUntilChanged, map, Observable, UnaryFunction } from "rxjs";
import { ProxyObservable } from ".";
import {
  asEnumerable,
  EnumerableItem,
  Enumerator,
  nonNullable,
  nthArg,
  property,
} from "../lib";
import { Transform } from "../types";

class SignalEnumerator<T> {
  constructor(private enumerator: Enumerator<T> = nthArg(1)) {}

  findIndex = (key: PropertyKey) => (value: T) =>
    asEnumerable(value).map(this.enumerator).indexOf(key);

  enumerate = (value: T) => asEnumerable(value).map(this.enumerator);
}

class SignalChain<T> {
  constructor(
    public pull: (transform: Transform<T>) => Transform<unknown> = identity,
  ) {}

  push<U>(
    connector: UnaryFunction<Transform<U>, Transform<T>>,
  ): SignalChain<U> {
    return new SignalChain((transform) => this.pull(connector(transform)));
  }
}

export class Signal<T> extends ProxyObservable<T> {
  clone(): Signal<T> {
    return this;
  }

  get value(): Observable<T> {
    return this;
  }

  enumerator: SignalEnumerator<T>;
  chain: SignalChain<T>;

  constructor({
    value,
    enumerator = new SignalEnumerator(),
    chain = new SignalChain(),
  }: {
    value: Observable<T>;
    enumerator?: SignalEnumerator<T>;
    chain?: SignalChain<T>;
  }) {
    super(value);

    this.enumerator = enumerator;
    this.chain = chain;
  }

  private project<U>(
    projector: UnaryFunction<T, U>,
    connector: UnaryFunction<Transform<U>, Transform<T>>,
    enumerator?: Enumerator<U>,
  ): Signal<U> {
    return new Signal({
      value: this.pipe(map(projector), distinctUntilChanged()),
      enumerator: new SignalEnumerator(enumerator),
      chain: this.chain.push(connector),
    });
  }

  protected property<K extends keyof T>(
    key: K,
    enumerator?: Enumerator<T[K]>,
  ): Signal<T[K]> {
    const findProperty: UnaryFunction<T, T[K]> = property(key);

    return this.project(
      findProperty,
      (transform) => (value) => {
        value = clone(value);

        value[key] = transform(findProperty(value));

        return value;
      },
      enumerator,
    );
  }

  protected item(
    key: PropertyKey,
    enumerator?: Enumerator<EnumerableItem<T>>,
  ): Signal<EnumerableItem<T>> {
    const findIndex = this.enumerator.findIndex(key);
    const findItem: UnaryFunction<T, EnumerableItem<T>> = (value) =>
      nonNullable(asEnumerable(value)[findIndex(value)]);

    return this.project(
      findItem,
      (transform) => (value) => {
        if (Array.isArray((value = clone(value)))) {
          value[findIndex(value)] = transform(findItem(value));
        }

        return value;
      },
      enumerator,
    );
  }

  protected collection<K extends keyof EnumerableItem<T>>(
    key: K,
  ): Signal<EnumerableItem<T>[K][]> {
    return this.project(
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
    enumerator?: Enumerator<T[K]>,
  ): ComputedSignal<T[K]> {
    return new ComputedSignal(super.property(key, enumerator));
  }

  item(
    key: PropertyKey,
    enumerator?: Enumerator<EnumerableItem<T>>,
  ): ComputedSignal<EnumerableItem<T>> {
    return new ComputedSignal(super.item(key, enumerator));
  }

  collection<K extends keyof EnumerableItem<T>>(
    key: K,
  ): ComputedSignal<EnumerableItem<T>[K][]> {
    return new ComputedSignal(super.collection(key));
  }
}
