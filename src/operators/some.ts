import { map, OperatorFunction } from "rxjs";

export const some = (): OperatorFunction<unknown[], boolean> => (source) =>
  source.pipe(map((values) => values.some(Boolean)));
