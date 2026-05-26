import { lastValueFrom, of, toArray } from "rxjs";
import { expect, test } from "vitest";
import { ComputedSignal } from "./Signal";

test("projects", () =>
  lastValueFrom(
    new ComputedSignal({
      value: of({ number: 1 }, { number: 2 }, { number: 3 }),
    })
      .property("number")
      .pipe(toArray()),
  ).then((numbers) => expect(numbers).toEqual([1, 2, 3])));
