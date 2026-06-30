import { property } from "@cascateer/lib";
import { flatMap, ProxyReplaySubject, reduce } from "@cascateer/lib/observable";
import { partition, tap, thru, uniq, uniqBy } from "lodash";
import {
  distinct,
  filter,
  groupBy,
  map,
  mergeAll,
  mergeMap,
  Observable,
  scan,
  share,
} from "rxjs";
import { v4 } from "uuid";
import {
  accumulate,
  exchangeWith,
  MulticastActionMessage,
  MulticastClientMessage,
} from "./operators";
import {
  assertIsMulticastSeedActionMessage,
  isMulticastSeedActionMessage,
  MulticastConnectMessage,
} from "./operators/multicast";

declare var self: ServiceWorkerGlobalScope;

declare global {
  interface ServiceWorkerGlobalScopeEventMap {
    connect: MessageEvent;
  }
}

type InMessages = {
  connect: MulticastConnectMessage;
  actions: MulticastActionMessage<any>[];
};

type OutMessages = {
  actions: MulticastActionMessage<any>[];
  ports: MessagePort[];
};

const actions = new ProxyReplaySubject<Observable<InMessages>, OutMessages>(
  (messages) =>
    messages.pipe(
      mergeAll(),
      groupBy(({ connect }) => connect.data.key),
      mergeMap((group) =>
        group.pipe(
          scan<InMessages, OutMessages>(
            (outMessages, inMessages, index) => ({
              actions: uniqBy(
                outMessages.actions.concat(
                  index === 0
                    ? {
                        id: v4(),
                        type: "seedAction" as const,
                        data: inMessages.connect.data,
                      }
                    : [],
                  ...inMessages.actions,
                ),
                property("id"),
              ),
              ports: uniq(
                outMessages.ports.concat(inMessages.connect.origin ?? []),
              ),
            }),
            {
              actions: new Array<MulticastActionMessage<any>>(),
              ports: new Array<MessagePort>(),
            },
          ),
        ),
      ),
      share(),
    ),
);

self.addEventListener("connect", ({ ports }) => {
  for (const port of ports) {
    actions.next(
      actions.pipe(
        flatMap(({ ports, actions }) => (ports.includes(port) ? actions : [])),
        distinct(property("id")),
        filter((message) => !message.sameOrigin || message.origin === port),
        reduce(
          ({ id: previousId }, action) =>
            isMulticastSeedActionMessage(action)
              ? action
              : { ...action, previousId },
          (action) => tap(action, assertIsMulticastSeedActionMessage),
        ),
        map(({ origin, ...message }) => message),
        exchangeWith<MulticastClientMessage, MulticastActionMessage<any>>(port),
        map((message) => ({ ...message, origin: port })),
        accumulate(),
        flatMap((messages) =>
          thru(
            partition(messages, (message) => message.type === "connect"),
            ([[connect], actions]) =>
              connect != null ? { connect, actions } : [],
          ),
        ),
      ),
    );
  }
});

actions.subscribe();
