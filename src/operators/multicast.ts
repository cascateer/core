import { EndoFunction } from "@cascateer/lib";
import {
  DerivedSignal,
  ProxyReplaySubject,
  ProxySubject,
  exchangeMessages,
} from "@cascateer/lib/observable";
import { Function1 } from "lodash";
import { concatMap, shareReplay, startWith } from "rxjs";
import { v4 } from "uuid";

interface MulticastBaseMessage<Data, Type> {
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
      seed: string;
    };
  };
  transformAction: {
    predicate: EndoFunction<Data>;
    data: {
      key: string;
      args: string;
    };
  };
}

export type MulticastBaseActionMessage<
  Data,
  Type extends keyof MulticastActions<Data>,
> = MulticastBaseMessage<MulticastActions<Data>[Type]["data"], Type>;

export type MulticastActionMessage<Data> =
  | MulticastBaseActionMessage<Data, "seedAction">
  | MulticastBaseActionMessage<Data, "transformAction">;

export const isMulticastSeedActionMessage = <Data>(
  action: MulticastActionMessage<Data>,
): action is MulticastBaseActionMessage<Data, "seedAction"> =>
  action.type === "seedAction";

export const assertIsMulticastSeedActionMessage = <Data>(
  action: MulticastActionMessage<Data>,
): asserts action is MulticastBaseActionMessage<Data, "seedAction"> => {
  if (!isMulticastSeedActionMessage(action)) {
    throw new Error();
  }
};

export type MulticastAction<
  Data,
  Type extends keyof MulticastActions<Data> = keyof MulticastActions<Data>,
> = MulticastActionMessage<Data> &
  {
    [T in Type]: {
      type: T;
      target?: DerivedSignal<Data, unknown>;
      predicate: MulticastActions<Data>[T]["predicate"];
      callback?: Function1<Data, void>;
    };
  }[Type];

export interface MulticastConnectMessageData {
  key: string;
  seed: string;
}

export type MulticastConnectMessage = MulticastBaseMessage<
  MulticastConnectMessageData,
  "connect"
>;

export type MulticastHostMessage = MulticastActionMessage<any>;
export type MulticastClientMessage =
  MulticastActionMessage<any> | MulticastConnectMessage;

type MulticastMessage = MulticastHostMessage | MulticastClientMessage;

export type MulticastMessageConstructor<Message extends MulticastMessage> =
  Function1<Record<"key" | "id", string>, Promise<Message>>;

export interface MulticastSubject extends ProxySubject<
  MulticastMessageConstructor<MulticastClientMessage>,
  MulticastHostMessage
> {}

export const multicast = <Seed>(key: string, seed: Seed): MulticastSubject =>
  new ProxyReplaySubject((messages) =>
    messages.pipe(
      startWith(({ key, id }): MulticastConnectMessage => ({
        id,
        type: "connect",
        data: {
          key,
          seed: JSON.stringify(seed),
        },
      })),
      concatMap(async (message) => message({ key, id: v4() })),
      exchangeMessages<MulticastHostMessage, MulticastClientMessage>(
        new SharedWorker(new URL("../multicast.ts", import.meta.url), {
          type: "module",
        }).port,
      ),
      shareReplay({ refCount: false }),
    ),
  );
