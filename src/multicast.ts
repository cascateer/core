import {
  combineLatest,
  groupBy,
  map,
  mergeAll,
  mergeMap,
  Observable,
  partition,
  tap,
} from "rxjs";
import { v4 } from "uuid";
import { nonNullable } from "./lib";
import {
  concatLeft,
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

const actions = proxyReplaySubject<
  Observable<[MulticastConnectMessage<any>, MulticastActionMessage<any>]>,
  {
    ports: MessagePort[];
    action: MulticastActionMessage<any>;
  }
>((messages) =>
  messages.pipe(
    mergeAll(),
    groupBy(([connect]) => connect.data.key),
    mergeMap((group) =>
      group.pipe(
        flatMap(([connect, action], index) =>
          index
            ? action
            : [
                {
                  id: v4(),
                  type: "seedAction" as const,
                  data: {
                    seed: connect.data.seed,
                  },
                },
                action,
              ],
        ),
        concatLeft(),
        flatMap((actions) =>
          0 in actions
            ? {
                ports: actions.flatMap((action) => action.origin ?? []),
                action: actions[0],
              }
            : [],
        ),
      ),
    ),
  ),
);

self.addEventListener("connect", ({ ports }) => {
  for (const port of ports) {
    actions.next(
      proxyReplaySubject<
        [MulticastConnectMessage<any>, MulticastActionMessage<any>]
      >((sliceActions) =>
        actions.pipe(
          flatMap(({ ports, action: { origin, ...message } }) =>
            ports.includes(port) && (!message.sameOrigin || origin === port)
              ? message
              : [],
          ),
          sequence(([action, previousAction]) =>
            action.type === "seedAction"
              ? action
              : {
                  ...action,
                  previousId: nonNullable(previousAction).id,
                },
          ),
          exchangeWith<MulticastClientMessage, MulticastActionMessage<any>>(
            port,
          ),
          map((event) => ({ ...event, origin: port })),
          (messages) =>
            combineLatest(
              partition(messages, (message) => message.type === "connect"),
            ),
          tap(sliceActions),
        ),
      ),
    );
  }
});

actions.subscribe();
