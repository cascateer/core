import { map, OperatorFunction } from "rxjs";
import { concat } from "./concat";

export const concatLeft =
  <T>(): OperatorFunction<T | T[], T[]> =>
  (source) =>
    source.pipe(
      concat(),
      map((value) => value.toReversed()),
    );
