import * as lodash from "lodash";
import objectHash from "object-hash";

export const memoize = <T extends (...args: any) => any>(func: T) =>
  lodash.memoize(func, (...args: Parameters<T>) => objectHash(args ?? null));
