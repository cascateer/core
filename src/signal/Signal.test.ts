import { EndoFunction } from "@cascateer/lib";
import {
  identity,
  lastValueFrom,
  of,
  ReplaySubject,
  scan,
  startWith,
  toArray,
} from "rxjs";
import { expect, test } from "vitest";
import { ComputedSignal } from ".";

test("projection", () => {
  const signal = new ComputedSignal({
    value: of({ number: 1 }, { number: 2 }, { number: 3 }),
  }).property("number");

  return lastValueFrom(signal.pipe(toArray())).then((numbers) =>
    expect(numbers).toEqual([1, 2, 3]),
  );
});

test("transformation", () => {
  const transforms = new ReplaySubject<EndoFunction<{ number: number }>>();
  const signal = new ComputedSignal<{ number: number }>({
    value: transforms.pipe(
      startWith(identity),
      scan((state, transform) => transform(state), { number: 1 }),
    ),
  }).property("number");

  transforms.next(signal.retract((number) => number + 1));
  transforms.next(signal.retract((number) => number + 2));
  transforms.complete();

  return lastValueFrom(signal.pipe(toArray())).then((numbers) =>
    expect(numbers).toEqual([1, 2, 4]),
  );
});
