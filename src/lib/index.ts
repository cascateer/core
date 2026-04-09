import { Observable, of } from "rxjs";
import { isObservable } from "rxjs/internal/util/isObservable";
import { MaybeArray, MaybeObservable } from "../types";

export { chunkWith } from "./chunkWith";
export {
  asEnumerable,
  type Enumerable,
  type EnumerableItem,
  type Enumerator,
} from "./Enumerable";
export { ExtendableDictionary } from "./ExtendableDictionary";
export { keys } from "./keys";
export { nthArg } from "./nthArg";
export { property } from "./property";

export const asArray = <T>(array: MaybeArray<T>): Array<T> =>
  Array.isArray(array) ? array : [array];

export const asObservable = <T>(value: MaybeObservable<T>): Observable<T> =>
  isObservable(value) ? value : of(value);

export const nonNullable = <T>(value: T): NonNullable<T> => {
  if (value == null) {
    throw new Error(`${value} is nil`);
  }

  return value;
};
