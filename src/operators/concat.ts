import { OperatorFunction, scan } from "rxjs";

export const concat =
  <T>(): OperatorFunction<T | T[], T[]> =>
  (source) =>
    source.pipe(scan((acc, curr) => acc.concat(curr), new Array<T>()));
