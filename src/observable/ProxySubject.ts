import { once } from "lodash";
import {
  Observable,
  Observer,
  Subject,
  UnaryFunction,
  Unsubscribable,
} from "rxjs";

export class ProxySubject<T, R = T>
  extends Observable<R>
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
    private target: Subject<T>,
    project: UnaryFunction<Observable<T>, Observable<R>>,
  ) {
    project = once(project);

    super((subscriber) => project(target).subscribe(subscriber));
  }
}
