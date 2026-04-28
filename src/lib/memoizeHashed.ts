import { memoize } from "lodash";
import objectHash from "object-hash";

export const memoizeHashed = <T extends (...args: any) => any>(func: T) =>
  memoize(func, (...args: Parameters<T>) => objectHash(args ?? null));
