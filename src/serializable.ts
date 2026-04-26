import { Dictionary, isObject, isString } from "lodash";
import { Brand, identity } from "ts-brand";
import { v4 } from "uuid";
import { Accessor } from "./lib/accessor";

interface Serializer<O> {
  (): O & { $ref: string };
}

enum SerializerBrand {}

type BrandedSerializer<O> = Brand<Serializer<O>, SerializerBrand>;

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

      return import(url).then((module) =>
        new Accessor(module)
          .get<SerializableConstructor<T, O>>(...path.split("/"))
          .value.fromObject(obj),
      );
    }
  }

  static toJSON<T, O>(
    ctor: SerializableConstructor<T, O>,
    value: Serializable<O>,
  ): BrandedSerializer<O> {
    const $ref = new Accessor(this, `${import.meta.url}#`, this.name)
      .get("importMap")
      .set(v4(), ctor)
      .path.join("/");

    return identity<BrandedSerializer<O>>(() => ({
      ...value.toObject(),
      $ref,
    }));
  }

  abstract toObject(): O;
  abstract toJSON: BrandedSerializer<O>;
}
