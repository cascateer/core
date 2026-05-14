import { Dictionary, get } from "lodash";
import { Brand, identity } from "ts-brand";
import { v4 } from "uuid";

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

      console.log({
        url,
        pointer,
        path: pointer?.split("/"),
        name: Serializable.name,
        got: get(Serializable, pointer?.split("/").slice(1) ?? []),
      });

      if (url === import.meta.url && pointer != null) {
        const path = pointer.split("/");

        if (path[0] === Serializable.name) {
          return (
            get(Serializable, path.slice(1)) as SerializableConstructor<T, O>
          ).fromObject(value);
        }
      }
    } catch {}

    return JSON.parse(json);
  }

  static toJSON<T, O>(
    ctor: SerializableConstructor<T, O>,
    value: Serializable<O>,
  ): BrandedSerializer<O> {
    const importMap = "importMap" satisfies keyof typeof Serializable;
    const id = v4();

    this[importMap][id] = ctor;

    return identity<BrandedSerializer<O>>(() => ({
      value: value.toObject(),
      $ref: [`${import.meta.url}#`, this.name, importMap, id].join("/"),
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
