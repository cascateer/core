import { clone, identity, isEqual, memoize } from "lodash";
import { distinctUntilChanged, map, Observable, of, UnaryFunction } from "rxjs";
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
  constructor(private predicate: Enumerator<T> = nthArg(1)) {}

  findIndex = (key: PropertyKey) => (value: T) =>
    asEnumerable(value).map(this.predicate).indexOf(key);

  enumerate = (value: T) => asEnumerable(value).map(this.predicate);
}

class SignalReflector<T> {
  constructor(
    public predicate: (
      transform: Transform<T>,
    ) => Transform<unknown> = identity,
  ) {}

  reflect = <U>(
    lift: UnaryFunction<Transform<U>, Transform<T>>,
  ): SignalReflector<U> =>
    new SignalReflector((transform) => this.predicate(lift(transform)));
}

export class Signal<T> extends ProxyObservable<T> {
  clone(): Signal<T> {
    return this;
  }

  get value(): Observable<T> {
    return this;
  }

  enumerator: SignalEnumerator<T>;
  reflector: SignalReflector<T>;

  constructor({
    value,
    enumerator = new SignalEnumerator(),
    reflector = new SignalReflector(),
  }: {
    value: Observable<T>;
    enumerator?: SignalEnumerator<T>;
    reflector?: SignalReflector<T>;
  }) {
    super(value, identity, of(false));

    this.enumerator = enumerator;
    this.reflector = reflector;
  }

  private project<U>(
    project: UnaryFunction<T, U>,
    lift: UnaryFunction<Transform<U>, Transform<T>>,
    enumerate?: Enumerator<U>,
  ): Signal<U> {
    return new Signal({
      value: this.pipe(map(project), distinctUntilChanged()),
      enumerator: new SignalEnumerator(enumerate),
      reflector: this.reflector.reflect(lift),
    });
  }

  protected property<K extends keyof T>(
    key: K,
    enumerate?: Enumerator<T[K]>,
  ): Signal<T[K]> {
    const findProperty: UnaryFunction<T, T[K]> = property(key);

    return this.project(
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

    return this.project(
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
    iteratee: UnaryFunction<Signal<EnumerableItem<T>>, U>,
  ): Observable<U[]> {
    const memoizedIteratee = memoize<UnaryFunction<PropertyKey, U>>((key) =>
      iteratee(this.item(key)),
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
