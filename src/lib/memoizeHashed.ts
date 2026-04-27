import { memoize } from "lodash";

export const memoizeHashed = <T extends (...args: any) => any>(func: T) =>
  memoize(func, (...args: Parameters<T>) => JSON.stringify(args ?? null));
