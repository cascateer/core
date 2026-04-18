import { Observer, Subject, Unsubscribable } from "rxjs";
import { ProxyObservable, ProxyObservableHandler } from "./ProxyObservable";

export class ProxySubject<T, U = T>
  extends ProxyObservable<T, U>
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
    handler: ProxyObservableHandler<T, U>,
  ) {
    super(target, handler);
  }
}
