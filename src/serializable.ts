import { Dictionary, get } from "lodash";
import { Brand, identity } from "ts-brand";
import { v4 } from "uuid";
import * as module from ".";

interface SerializerResult<O> {
  value: O;
  $ref: string;
}

export interface Serializer<O> {
  (): SerializerResult<O>;
}

enum SerializerBrand {}

export type BrandedSerializer<O> = Brand<Serializer<O>, SerializerBrand>;

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

        import(url).then(console.log);

        if (a != null) {
          const serializable = get(module, a);

          if (serializable === Serializable && b === "importMap" && c != null) {
            return (
              serializable[b][c] as SerializableConstructor<T, O>
            ).fromObject(value);
          }
        }
      }
    } catch {}

    return JSON.parse(json);
  }

  static toJSON<T, O>(
    ctor: SerializableConstructor<T, O>,
    value: Serializable<O>,
  ): BrandedSerializer<O> {
    const IMPORT_MAP = "importMap",
      UUID = v4();

    this[IMPORT_MAP][UUID] = ctor;

    return identity<BrandedSerializer<O>>(() => ({
      value: value.toObject(),
      $ref: `${import.meta.url}#${[this.name, IMPORT_MAP, UUID].join("/")}`,
    }));
  }

  static parse(text: string) {
    return JSON.parse(text, (_, value) =>
      Serializable.fromJSON(JSON.stringify(value)),
    );
  }

  abstract toObject(): O;
  abstract toJSON: BrandedSerializer<O>;
}
