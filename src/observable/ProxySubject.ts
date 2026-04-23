import { Observer, Subject, Unsubscribable } from "rxjs";
import { ProxyObservable, ProxyObservableHandler } from "./ProxyObservable";

export class ProxySubject<T, R = T>
  extends ProxyObservable<T, R>
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
    handler: ProxyObservableHandler<T, R>,
  ) {
    super(target, handler);
  }
}
