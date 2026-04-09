import { Dictionary } from "lodash";
import { UnaryFunction } from "rxjs";
import { Future } from "../observable";
import { keys } from "./keys";

export type Extend<T, U> = Omit<T, keyof U> & U;

export class ExtendableDictionary<T, U extends Dictionary<T>> {
  constructor(
    public currentValue: U,
    private value = new Future<Dictionary<T>>(),
  ) {}

  complete(): U {
    return this.value.completeWith(this.currentValue);
  }

  extend<V extends Dictionary<T>>(
    value: (
      currentValue: U,
    ) => ({
      property,
    }: {
      property: (constructor: UnaryFunction<Promise<string>, T>) => T;
    }) => V,
  ) {
    return new ExtendableDictionary<T, Extend<U, V>>(
      {
        ...this.currentValue,
        ...value(this.currentValue)({
          property: (constructor) => {
            const property = constructor(
              this.value.once(
                (value) =>
                  new Promise<string>((resolve, reject) => {
                    for (const key of keys(value)) {
                      if (value[key] === property) {
                        return resolve(key);
                      }
                    }

                    reject();
                  }),
              ),
            );

            return property;
          },
        }),
      },
      this.value,
    );
  }
}
