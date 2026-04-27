import { map, OperatorFunction } from "rxjs";

export const every = (): OperatorFunction<any[], boolean> => (source) =>
  source.pipe(map((values) => values.every(Boolean)));
