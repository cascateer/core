import { once } from "lodash";
import { Observable, Observer, Subject, Unsubscribable } from "rxjs";

export interface ProxySubjectHandler<T, U> {
  (target: Subject<T>, receiver: Observable<U>): Observable<U>;
}

export class ProxySubject<T, U = T>
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
    private target: Subject<T>,
    handler: ProxySubjectHandler<T, U>,
  ) {
    handler = once(handler);

    super((subscriber) => handler(this.target, this).subscribe(subscriber));
  }
}
