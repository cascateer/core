export function nthArg<T>(n: 0): (arg0: T) => T;
export function nthArg<T>(n: 1): (arg0: any, arg1: T) => T;
export function nthArg<T>(n: 2): (arg0: any, arg1: any, arg2: T) => T;
export function nthArg<T>(n: number): (...args: any[]) => T {
  return (...args) => args[n];
}
