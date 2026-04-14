import { memoize, thru } from "lodash";
import { mergeAll, Observable, startWith, tap } from "rxjs";
import { v4 } from "uuid";
import { nonNullable, property } from "./lib";
import { Future } from "./observable";
import {
  exchangeWith,
  flatMap,
  MulticastActionMessage,
  MulticastClientMessage,
  MulticastConnectMessageData,
  sequence,
  transform,
} from "./operators";

declare var self: ServiceWorkerGlobalScope;

declare global {
  interface ServiceWorkerGlobalScopeEventMap {
    connect: MessageEvent;
  }
}

const memoizedSliceActions = memoize(
  <Seed>({ seed }: MulticastConnectMessageData<Seed>) =>
    transform<MulticastActionMessage<any>>((actions) =>
      actions.pipe(
        startWith({
          id: v4(),
          type: "seedAction" as const,
          data: {
            seed,
          },
        }),
      ),
    ),
  property("key"),
);

self.addEventListener("connect", ({ ports }) => {
  for (const port of ports) {
    thru(
      new Future<Observable<MulticastActionMessage<any>>>(),
      (sliceActions) =>
        transform<MulticastActionMessage<any>, MulticastClientMessage>(
          (actions) =>
            sliceActions.pipe(
              mergeAll(),
              flatMap(({ origin, ...message }) =>
                !message.sameOrigin || origin === port ? message : [],
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
              flatMap((event) => {
                if (event.type === "connect") {
                  actions.subscribe(
                    sliceActions.completeWith(memoizedSliceActions(event.data)),
                  );

                  return [];
                }

                return { ...event, origin: port };
              }),
              tap(actions),
            ),
        ),
    ).subscribe();
  }
});
