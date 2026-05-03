import { Dictionary, get, isObject, isString } from "lodash";
import { Brand, identity } from "ts-brand";
import { v4 } from "uuid";

export interface Serializer<O> {
  (): O & { $ref: string };
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

  static async fromJSON<T, O>(value: string): Promise<T> {
    const obj: O = JSON.parse(value);

    if (isObject(obj) && "$ref" in obj && isString(obj.$ref)) {
      const [url, path] = obj.$ref.split(/#\/?/);

      if (url != null && path != null) {
        return import(url).then((module) =>
          (
            get(module, path.split("/")) as SerializableConstructor<T, O>
          ).fromObject(obj),
        );
      }
    }

    throw new Error(`${value} deserialization failed`);
  }

  static toJSON<T, O>(
    ctor: SerializableConstructor<T, O>,
    value: Serializable<O>,
  ): BrandedSerializer<O> {
    const importMap = "importMap" satisfies keyof typeof Serializable;
    const id = v4();

    this[importMap][id] = ctor;

    return identity<BrandedSerializer<O>>(() => ({
      ...value.toObject(),
      $ref: [`${import.meta.url}#`, this.name, importMap, id].join("/"),
    }));
  }

  abstract toObject(): O;
  abstract toJSON: BrandedSerializer<O>;
}
