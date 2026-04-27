import { map, OperatorFunction } from "rxjs";

export const some = (): OperatorFunction<any[], boolean> => (source) =>
  source.pipe(map((values) => values.some(Boolean)));
