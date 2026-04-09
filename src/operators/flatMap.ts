import { OperatorFunction, from, map, mergeMap } from "rxjs";

export const flatMap =
  <T, U>(
    project: (value: T, index: number) => U | U[],
  ): OperatorFunction<T, U> =>
  (source) =>
    source.pipe(
      map(project),
      mergeMap((value) => from(Array.isArray(value) ? value : [value])),
    );
