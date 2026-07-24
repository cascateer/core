import { Dictionary } from "lodash";
import { Brand } from "utility-types";
import { v4 } from "uuid";

enum SerializerBrand {}

interface SerializerResult<O> {
  value: O;
  $ref: string;
}

export interface Serializer<O> {
  (): Brand<SerializerResult<O>, SerializerBrand>;
}

interface SerializableConstructor<T, O> {
  name: string;
  fromObject(obj: O): T;
}

export abstract class Serializable<O> {
  static readonly importMap: Dictionary<
    SerializableConstructor<unknown, unknown>
  > = {};

  static fromJSON<T, O>(json: string): T {
    try {
      const { $ref, value }: SerializerResult<O> = JSON.parse(json),
        [url, pointer] = $ref.split(/#\/?/);

      if (url === import.meta.url) {
        const [a, b, c] = pointer?.split("/") ?? [];

        if (a === Serializable.name && b === "importMap" && c != null)
          return (
            Serializable[b][c] as SerializableConstructor<T, O>
          ).fromObject(value);
      }
    } catch {}

    return JSON.parse(json);
  }

  static toJSON<T, O>(
    ctor: SerializableConstructor<T, O>,
    value: Serializable<O>,
  ): Serializer<O> {
    const IMPORT_MAP = "importMap",
      UUID = v4();

    this[IMPORT_MAP][UUID] = ctor;

    return () =>
      ({
        value: value.toObject(),
        $ref: `${import.meta.url}#${[this.name, IMPORT_MAP, UUID].join("/")}`,
      }) as Brand<SerializerResult<O>, SerializerBrand>;
  }

  static parse(text: string) {
    return JSON.parse(text, (_, value) =>
      Serializable.fromJSON(JSON.stringify(value)),
    );
  }

  abstract toObject(): O;
  abstract toJSON: Serializer<O>;
}
