import { EndoFunction, LazyDictionary } from "@cascateer/lib";
import { flatMap, reduce } from "@cascateer/lib/observable";
import { constant, Dictionary, mapValues, noop, tap } from "lodash";
import {
  merge,
  mergeMap,
  Observable,
  ReplaySubject,
  shareReplay,
  tap as tapOperator,
  UnaryFunction,
} from "rxjs";
import { MulticastAction, MulticastSubject } from "./operators";
import {
  assertIsMulticastSeedActionMessage,
  isMulticastSeedActionMessage,
  MulticastBaseActionMessage,
  MulticastClientMessage,
  MulticastMessageConstructor,
} from "./operators/multicast";
import { Serializable } from "./serializable";
import { ComputedSignal, Signal } from "./signal";
import { Action } from "./types";

type StoreEffect<Data, Result> = () => Signal<Data, Result>;

export type StoreEffects<
  Data,
  Signals extends Dictionary<ComputedSignal<Data, any>>,
> = {
  [K in keyof Signals]: ReturnType<
    <
      Result extends (Signals[K] extends ComputedSignal<Data, infer Result>
        ? Result
        : never),
    >() => StoreEffect<Data, Result>
  >;
};

export const asStoreEffects = <
  Data,
  Signals extends Dictionary<ComputedSignal<Data, any>>,
>(
  signals: Signals,
): StoreEffects<Data, Signals> =>
  mapValues(signals, (signal) => () => signal.clone());

export class StoreAdapter<
  Data,
  Signals extends Dictionary<ComputedSignal<Data, any>>,
  Actions extends Dictionary<Action<any, any>>,
> {
  constructor(
    public signals: Signals,
    public actions: Actions,
  ) {}
}

export class LazyStoreAdapter<
  Data,
  Signals extends Dictionary<ComputedSignal<Data, any>>,
  Actions extends Dictionary<Action<any, any>>,
> {
  complete(): StoreAdapter<Data, Signals, Actions> {
    return new StoreAdapter(
      this.lazySignals.complete(),
      this.lazyActions.complete(),
    );
  }

  constructor(
    public transform: {
      share: UnaryFunction<
        MulticastMessageConstructor<MulticastClientMessage>,
        void
      >;
      parse: (
        key: Promise<string>,
        handler: (
          action: MulticastBaseActionMessage<any, "transformAction">,
        ) => MulticastAction<Data, "transformAction">,
      ) => void;
    },
    private lazySignals: LazyDictionary<ComputedSignal<Data, any>, Signals>,
    private lazyActions: LazyDictionary<Action<any, any>, Actions>,
  ) {}

  provideEffects<MoreSignals extends Dictionary<ComputedSignal<Data, any>>>(
    effects: UnaryFunction<
      {
        effect: <T>(
          constructor: UnaryFunction<Signals, ComputedSignal<Data, T>>,
        ) => ComputedSignal<Data, T>;
      },
      MoreSignals
    >,
  ) {
    return new LazyStoreAdapter(
      this.transform,
      this.lazySignals.extend(
        (currentSignals) => () =>
          effects({
            effect: (constructor) => constructor(currentSignals),
          }),
      ),
      this.lazyActions,
    );
  }

  provideActions<MoreActions extends Dictionary<Action<any, any>>>(
    actions: UnaryFunction<
      {
        action: <Args>(
          constructor: UnaryFunction<
            {
              [K in keyof Signals]: {
                update: <
                  T extends (Signals[K] extends ComputedSignal<Data, infer T>
                    ? T
                    : never),
                >(
                  predicate: UnaryFunction<Args, EndoFunction<T>>,
                  config?: { sameOrigin?: boolean },
                ) => Action<Args, any>;
              };
            },
            Action<Args, any>
          >,
        ) => Action<Args, any>;
      },
      MoreActions
    >,
  ) {
    return new LazyStoreAdapter(
      this.transform,
      this.lazySignals,
      this.lazyActions.extend(
        () =>
          ({ property }) =>
            actions({
              action: (constructor) =>
                property((key) =>
                  constructor(
                    mapValues(this.lazySignals.currentValue, (target) => ({
                      update: (predicate, config = {}) => {
                        const callbacks = new Map<
                          string,
                          UnaryFunction<Data, void>
                        >();

                        this.transform.parse(key, (event) => ({
                          ...event,
                          target,
                          predicate: target.retract(
                            predicate(
                              Serializable.parse(event.data.args ?? null),
                            ),
                          ),
                          callback: callbacks.get(event.id),
                        }));

                        return (args) =>
                          new Promise<Data>((callback) =>
                            this.transform.share(
                              async ({ id }) => (
                                callbacks.set(id, callback),
                                {
                                  id,
                                  type: "transformAction",
                                  data: {
                                    key: await key,
                                    args: JSON.stringify(args),
                                  },
                                  sameOrigin: config.sameOrigin,
                                }
                              ),
                            ),
                          );
                      },
                    })),
                  ),
                ),
            }),
      ),
    );
  }
}

export class StoreProvider<Data> extends LazyStoreAdapter<
  Data,
  { data: ComputedSignal<Data> },
  {}
> {
  constructor({ actions }: { actions: MulticastSubject }) {
    const transformActions = new ReplaySubject<
      MulticastAction<Data, "transformAction">
    >();
    const seedActions: Observable<MulticastAction<Data, "seedAction">> =
      actions.pipe(
        flatMap((event) =>
          event.type === "seedAction"
            ? {
                ...event,
                predicate: constant(Serializable.parse(event.data.seed)),
              }
            : [],
        ),
      );

    super(
      {
        share: (action) => actions.next(action),
        parse: (key, handler) =>
          actions
            .pipe(
              mergeMap(async (event) => {
                if (
                  event.type === "transformAction" &&
                  event.data.key === (await key)
                ) {
                  return handler(event);
                }
              }),
              flatMap((action) => action ?? []),
            )
            .subscribe(transformActions),
      },
      new LazyDictionary({
        data: new ComputedSignal({
          value: merge(seedActions, transformActions).pipe(
            tapOperator((action) => console.log(action)),
            reduce<MulticastAction<Data>, Data>(
              (previousState, action, previousAction) => {
                if (isMulticastSeedActionMessage(action)) {
                  return action.predicate();
                }

                if (action.previousId !== previousAction?.id) {
                  throw new Error();
                }

                return tap(
                  action.predicate(previousState),
                  action.callback ?? noop,
                );
              },
              (action) => (
                assertIsMulticastSeedActionMessage(action),
                action.predicate()
              ),
            ),
            shareReplay(1),
          ),
        }),
      }),
      new LazyDictionary({}),
    );
  }
}
