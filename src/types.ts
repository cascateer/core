import { UnaryFunction } from "rxjs";
import { Observable } from "rxjs/internal/Observable";

export interface Effect<Args, Result> extends UnaryFunction<
  Args,
  Observable<Result>
> {}

export interface Action<Args, Result> extends UnaryFunction<
  Args,
  Promise<Result>
> {}
