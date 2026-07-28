import { EndoFunction, LazyDictionary, Serializable } from "@cascateer/lib";
import {
  DerivedSignal,
  flatMap,
  reduce,
  Signal,
} from "@cascateer/lib/observable";
import { constant, Dictionary, Function1, mapValues, noop, tap } from "lodash";
import {
  merge,
  mergeMap,
  Observable,
  ReplaySubject,
  shareReplay,
  tap as tapOperator,
} from "rxjs";
import { MulticastAction, MulticastSubject } from "./operators";
import {
  assertIsMulticastSeedActionMessage,
  isMulticastSeedActionMessage,
  MulticastBaseActionMessage,
  MulticastClientMessage,
  MulticastMessageConstructor,
} from "./operators/multicast";
import { Action } from "./types";

type StoreEffect<Data, Result> = () => Signal<Data, Result>;

export type StoreEffects<
  Data,
  Signals extends Dictionary<DerivedSignal<Data, any>>,
> = {
  [K in keyof Signals]: ReturnType<
    <
      Result extends (Signals[K] extends DerivedSignal<Data, infer Result>
        ? Result
        : never),
    >() => StoreEffect<Data, Result>
  >;
};

export const asStoreEffects = <
  Data,
  Signals extends Dictionary<DerivedSignal<Data, any>>,
>(
  signals: Signals,
): StoreEffects<Data, Signals> =>
  mapValues(signals, (signal) => () => signal.clone());

export class StoreAdapter<
  Data,
  Signals extends Dictionary<DerivedSignal<Data, any>>,
  Actions extends Dictionary<Action<any, any>>,
> {
  constructor(
    public signals: Signals,
    public actions: Actions,
  ) {}
}

export class LazyStoreAdapter<
  Data,
  Signals extends Dictionary<DerivedSignal<Data, any>>,
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
      share: Function1<
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
    private lazySignals: LazyDictionary<DerivedSignal<Data, any>, Signals>,
    private lazyActions: LazyDictionary<Action<any, any>, Actions>,
  ) {}

  provideEffects<MoreSignals extends Dictionary<DerivedSignal<Data, any>>>(
    effects: Function1<
      {
        effect: <T>(
          constructor: Function1<Signals, DerivedSignal<Data, T>>,
        ) => DerivedSignal<Data, T>;
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
    actions: Function1<
      {
        action: <Args>(
          constructor: Function1<
            {
              [K in keyof Signals]: {
                update: <
                  T extends (Signals[K] extends DerivedSignal<Data, infer T>
                    ? T
                    : never),
                >(
                  predicate: Function1<Args, EndoFunction<T>>,
                  config?: { sameOrigin?: boolean },
                ) => Action<Args, Data>;
              };
            },
            Action<Args, Data>
          >,
        ) => Action<Args, Data>;
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
                          Function1<Data, void>
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
  { data: DerivedSignal<Data> },
  {}
> {
  constructor({ actions }: { actions: MulticastSubject }) {
    const transformActions = new ReplaySubject<
      MulticastAction<Data, "transformAction">
    >();
    const seedActions: Observable<MulticastAction<Data, "seedAction">> =
      actions.pipe(
        flatMap((event) =>
          isMulticastSeedActionMessage(event)
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
        data: new DerivedSignal({
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
