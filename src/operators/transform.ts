import { Observable, Subject, UnaryFunction } from "rxjs";
import { TransformSubject } from "../observable";

export const transform = <T, U = T>(
  project: UnaryFunction<Subject<T>, Observable<U>>,
  target?: Subject<T>,
) => new TransformSubject(project, target);
