import { UnaryFunction } from "rxjs";

export { ComputedSignal, Signal } from "./Signal";

export interface Transform<T> extends UnaryFunction<T, T> {}

export interface TransformOperator<T, U> extends UnaryFunction<
  Transform<T>,
  Transform<U>
> {}
