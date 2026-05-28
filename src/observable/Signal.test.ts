import { identity } from "lodash";
import {
  lastValueFrom,
  of,
  ReplaySubject,
  scan,
  startWith,
  toArray,
} from "rxjs";
import { expect, test } from "vitest";
import { Transform } from "../types";
import { ComputedSignal } from "./Signal";

test("projection", () => {
  const signal = new ComputedSignal({
    value: of({ number: 1 }, { number: 2 }, { number: 3 }),
  }).property("number");

  lastValueFrom(signal.pipe(toArray())).then((numbers) =>
    expect(numbers).toEqual([1, 2, 3]),
  );
});

test("transformation", () => {
  const transforms = new ReplaySubject<Transform<any>>();
  const signal = new ComputedSignal({
    value: transforms.pipe(
      startWith(identity),
      scan((state, transform) => transform(state), { number: 1 }),
    ),
  }).property("number");

  transforms.next(signal.chain.pull((number) => number + 1));
  transforms.next(signal.chain.pull((number) => number + 2));
  transforms.complete();

  return lastValueFrom(signal.pipe(toArray())).then((numbers) =>
    expect(numbers).toEqual([1, 2, 4]),
  );
});
