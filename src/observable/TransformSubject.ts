import { once } from "lodash";
import {
  Observable,
  Observer,
  ReplaySubject,
  Subject,
  UnaryFunction,
  Unsubscribable,
} from "rxjs";

export class TransformSubject<T, U = T>
  extends Observable<U>
  implements Observer<T>, Unsubscribable
{
  next(value: T): void {
    this.target.next(value);
  }

  error(err: any): void {
    this.target.error(err);
  }

  complete(): void {
    this.target.complete();
  }

  unsubscribe(): void {
    this.target.unsubscribe();
  }

  constructor(
    project: UnaryFunction<Subject<T>, Observable<U>>,
    private target: Subject<T> = new ReplaySubject(),
  ) {
    project = once(project);

    super((subscriber) => project(target).subscribe(subscriber));
  }
}
