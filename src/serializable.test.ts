import { omit } from "lodash";
import { expect, test } from "vitest";
import { Serializable, Serializer } from "./serializable";

test("Serializable", () => {
  interface SquareObject {
    a: number;
    b: number;
  }

  class Square implements Serializable<SquareObject> {
    constructor(
      public a: number,
      public b: number,
    ) {}

    static fromObject(obj: SquareObject) {
      return new Square(obj.a, obj.b);
    }

    toObject(): SquareObject {
      return {
        a: this.a,
        b: this.b,
      };
    }

    toJSON: Serializer<SquareObject> = Serializable.toJSON(Square, this);
  }

  const square = new Square(24, 2);
  const stringifiedSquare = JSON.stringify(square);
  const parsedSquare = Serializable.fromJSON<Square, SquareObject>(
    stringifiedSquare,
  );

  expect(JSON.parse(stringifiedSquare).value).toEqual({ a: 24, b: 2 });
  expect(JSON.parse(stringifiedSquare).$ref).toMatch(
    /serializable.ts#Serializable\/importMap\//,
  );

  expect(parsedSquare).toBeInstanceOf(Square);
  expect(omit(parsedSquare, "toJSON")).toEqual({
    a: 24,
    b: 2,
  });
});
