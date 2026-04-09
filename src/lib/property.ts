export const property =
  <T, K extends keyof T = keyof T>(key: K) =>
  (value: T): T[K] =>
    value[key];
