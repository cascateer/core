import { partition, thru, uniq, uniqBy } from "lodash";
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
  shareReplay,
} from "rxjs";
import { v4 } from "uuid";
import { property } from "./lib";
import {
  concat,
  exchangeWith,
  flatMap,
  MulticastActionMessage,
  MulticastClientMessage,
  proxyReplaySubject,
  sequence,
} from "./operators";
import { MulticastConnectMessage } from "./operators/multicast";

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

const actions = proxyReplaySubject<Observable<InMessages>, OutMessages>(
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
        sequence(([action, previousAction]) =>
          action.type === "seedAction"
            ? action
            : { ...action, previousId: previousAction!.id },
        ),
        exchangeWith<MulticastClientMessage, MulticastActionMessage<any>>(port),
        shareReplay(),
        map((message) => ({ ...message, origin: port })),
        concat(),
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
