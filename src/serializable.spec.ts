import { Serializable } from "./serializable";

interface SquareObject {
  x: number;
  y: number;
}

export interface Square extends Square {}

export class Square implements Serializable<SquareObject> {
  constructor({ x, y }: SquareObject) {
    this.x = x;
    this.y = y;
  }

  static fromObject(obj: SquareObject): Square {
    return new Square(obj);
  }

  toObject(): SquareObject {
    return { x: this.x, y: this.y };
  }

  toJSON = Serializable.toJSON(Square, this);
}

Serializable.fromJSON<Square, SquareObject>(
  JSON.stringify(new Square({ x: 2, y: 24 })),
);
