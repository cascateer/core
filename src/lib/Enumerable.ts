export class Enumerable<T> extends Array<
  T extends readonly (infer Index)[] ? Index : never
> {
  constructor(value: T) {
    super();

    this.push(...(Array.isArray(value) ? value : []));
  }
}

export type EnumerableItem<
  T,
  Index extends number = number,
> = Enumerable<T>[Index];

export interface Enumerator<T> {
  <Index extends number>(
    item: EnumerableItem<T, Index>,
    index: Index,
  ): PropertyKey;
}

export const asEnumerable = <T>(value: T) => new Enumerable<T>(value);
