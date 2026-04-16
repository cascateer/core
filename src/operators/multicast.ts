import { concatMap, shareReplay, startWith, UnaryFunction } from "rxjs";
import { v4 } from "uuid";
import { ComputedSignal, ProxySubject } from "../observable";
import { exchangeWith, proxyReplaySubject } from "../operators";
import { Transform } from "../types";

interface MulticastBaseMessage<Type, Data> {
  id: string;
  previousId?: string;
  type: Type;
  data: Data;
  sameOrigin?: boolean;
  origin?: MessagePort;
}

interface MulticastActions<Data> {
  seedAction: {
    predicate: () => Data;
    data: {
      seed: Data;
    };
  };
  transformAction: {
    predicate: Transform<Data>;
    data: {
      key: string;
      args: unknown;
    };
  };
}

type MulticastBaseActionMessage<
  Data,
  Type extends keyof MulticastActions<Data>,
> = MulticastBaseMessage<Type, MulticastActions<Data>[Type]["data"]>;

export type MulticastActionMessage<Data> =
  | MulticastBaseActionMessage<Data, "seedAction">
  | MulticastBaseActionMessage<Data, "transformAction">;

export type MulticastAction<
  Data,
  Type extends keyof MulticastActions<Data> = keyof MulticastActions<Data>,
> = MulticastActionMessage<Data> &
  {
    [T in Type]: {
      type: T;
      target?: ComputedSignal<Data>;
      predicate: MulticastActions<Data>[T]["predicate"];
      callback?: UnaryFunction<Data, void>;
    };
  }[Type];

export interface MulticastConnectMessageData<Seed> {
  key: string;
  seed: Seed;
}

type MulticastConnectMessage<Seed = any> = MulticastBaseMessage<
  "connect",
  MulticastConnectMessageData<Seed>
>;

export type MulticastHostMessage = MulticastActionMessage<any>;
export type MulticastClientMessage =
  | MulticastActionMessage<any>
  | MulticastConnectMessage;

type MulticastMessage = MulticastHostMessage | MulticastClientMessage;

type MulticastMessageConstructor<Message extends MulticastMessage> =
  UnaryFunction<Record<"key" | "id", string>, Promise<Message>>;

export interface MulticastSubject extends ProxySubject<
  MulticastMessageConstructor<MulticastClientMessage>,
  MulticastHostMessage
> {}

export const multicast = <Seed>(
  key: Promise<string>,
  seed: Seed,
): MulticastSubject =>
  proxyReplaySubject((messages) =>
    messages.pipe(
      startWith(
        ({ key, id }): MulticastConnectMessage => ({
          id,
          type: "connect",
          data: { key, seed },
        }),
      ),
      concatMap((message) => key.then((key) => message({ key, id: v4() }))),
      exchangeWith<MulticastHostMessage, MulticastClientMessage>(
        new SharedWorker(new URL("../multicast.ts", import.meta.url), {
          type: "module",
        }).port,
      ),
      shareReplay({ refCount: false }),
    ),
  );
