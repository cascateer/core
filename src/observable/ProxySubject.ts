import { Observable, Observer, Subject, Unsubscribable } from "rxjs";
import { ProxyObservable, ProxyObservableDescriptor } from "./ProxyObservable";

export class ProxySubject<X, Y = X, T extends Subject<X> = Subject<X>>
  extends ProxyObservable<X, Y, T>
  implements Observer<X>, Unsubscribable
{
  next(value: X): void {
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
    private target: T,
    descriptor: ProxyObservableDescriptor<T, Observable<Y>>,
  ) {
    super(target, descriptor);
  }
}
