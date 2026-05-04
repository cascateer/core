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

  static async fromJSON<T, O>(json: string): Promise<T> {
    const { $ref, value }: SerializerResult<O> = JSON.parse(json);

    const [url, path] = $ref.split(/#\/?/);

    if (url != null && path != null) {
      return import(url).then((module) =>
        (
          get(module, path.split("/")) as SerializableConstructor<T, O>
        ).fromObject(value),
      );
    }

    throw new Error(`${json} deserialization failed`);
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

  abstract toObject(): O;
  abstract toJSON: BrandedSerializer<O>;
}
