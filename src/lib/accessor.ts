export class Accessor<T> {
  value: T;
  path: PropertyKey[];

  constructor(value: T, ...path: PropertyKey[]) {
    this.value = value;
    this.path = path;
  }

  get<R extends unknown, K1 extends keyof T = keyof T>(
    key1: K1,
  ): Accessor<T[K1] & R>;
  get<
    R extends unknown,
    K1 extends keyof T = keyof T,
    K2 extends keyof T[K1] = keyof T[K1],
  >(key1: K1, key2: K2): Accessor<T[K1][K2] & R>;
  get<
    R extends unknown,
    K1 extends keyof T = keyof T,
    K2 extends keyof T[K1] = keyof T[K1],
    K3 extends keyof T[K1][K2] = keyof T[K1][K2],
  >(key1: K1, key2: K2, key3: K3): Accessor<T[K1][K2][K3] & R>;
  get<
    R extends unknown,
    K1 extends keyof T = keyof T,
    K2 extends keyof T[K1] = keyof T[K1],
    K3 extends keyof T[K1][K2] = keyof T[K1][K2],
  >(key1: K1, key2: K2, key3: K3, ...[]: PropertyKey[]): Accessor<R>;
  get<R extends unknown>(...path: PropertyKey[]): Accessor<R> {
    return path.reduce(
      (acc, key) => new Accessor(acc.value[key], ...acc.path, key),
      this,
    ) as R;
  }

  set<K extends keyof T>(key: K, property: T[K]) {
    return new Accessor((this.value[key] = property), ...this.path, key);
  }
}
