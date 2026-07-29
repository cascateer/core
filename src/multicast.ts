import { property } from "@cascateer/lib";
import {
  exchangeMessages,
  flatMap,
  ProxyReplaySubject,
  reduce,
} from "@cascateer/lib/observable";
import { partition, tap, thru, uniqBy } from "lodash";
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
  ports: Set<MessagePort>;
};

const actions = new ProxyReplaySubject<Observable<InMessages>, OutMessages>(
  (messages) =>
    messages.pipe(
      mergeAll(),
      groupBy(({ connect }) => connect.data.key),
      mergeMap((group) =>
        group.pipe(
          scan<InMessages, OutMessages>(
            (outMessages, inMessages, index) => {
              if (inMessages.connect.origin != null) {
                outMessages.ports.add(inMessages.connect.origin);
              }

              return {
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
                ports: outMessages.ports,
              };
            },
            {
              actions: new Array<MulticastActionMessage<any>>(),
              ports: new Set<MessagePort>(),
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
        flatMap(({ ports, actions }) => (ports.has(port) ? actions : [])),
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
        exchangeMessages<MulticastClientMessage, MulticastActionMessage<any>>(
          port,
        ),
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
