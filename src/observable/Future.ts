import { once } from "lodash";
import { AsyncSubject, lastValueFrom, UnaryFunction } from "rxjs";

export class Future<T> extends AsyncSubject<T> {
  completeWith = once(<U extends T>(value: U): U => {
    this.next(value);
    this.complete();

    return value;
  });

  once<U>(predicate: UnaryFunction<T, U | PromiseLike<U>>): Promise<U> {
    return lastValueFrom(this).then(predicate);
  }

  then = this.once;
}
