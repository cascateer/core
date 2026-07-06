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

export type StoreEffect<Result> = () => Signal<Result>;

export type StoreEffects<Signals extends Dictionary<ComputedSignal<any>>> = {
  [K in keyof Signals]: ReturnType<
    <
      Result extends (Signals[K] extends ComputedSignal<infer Result>
        ? Result
        : never),
    >() => StoreEffect<Result>
  >;
};

export const asStoreEffects = <Signals extends Dictionary<ComputedSignal<any>>>(
  signals: Signals,
): StoreEffects<Signals> =>
  mapValues(signals, (signal) => () => signal.clone());

export class StoreAdapter<
  Signals extends Dictionary<ComputedSignal<any>>,
  Actions extends Dictionary<Action<any, any>>,
> {
  constructor(
    public signals: Signals,
    public actions: Actions,
  ) {}
}

export class ExtendableStoreAdapter<
  Signals extends Dictionary<ComputedSignal<any>>,
  Actions extends Dictionary<Action<any, any>>,
> {
  complete(): StoreAdapter<Signals, Actions> {
    return new StoreAdapter(
      this.extendableSignals.complete(),
      this.extendableActions.complete(),
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
        ) => MulticastAction<any, "transformAction">,
      ) => void;
    },
    private extendableSignals: LazyDictionary<ComputedSignal<any>, Signals>,
    private extendableActions: LazyDictionary<Action<any, any>, Actions>,
  ) {}

  provideSignals<MoreSignals extends Dictionary<ComputedSignal<any>>>(
    signals: UnaryFunction<
      {
        signal: <T>(
          constructor: UnaryFunction<Signals, ComputedSignal<T>>,
        ) => ComputedSignal<T>;
      },
      MoreSignals
    >,
  ) {
    return new ExtendableStoreAdapter(
      this.transform,
      this.extendableSignals.extend(
        (currentSignals) => () =>
          signals({
            signal: (constructor) => constructor(currentSignals),
          }),
      ),
      this.extendableActions,
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
                  T extends (Signals[K] extends ComputedSignal<infer T>
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
    return new ExtendableStoreAdapter(
      this.transform,
      this.extendableSignals,
      this.extendableActions.extend(
        () =>
          ({ property }) =>
            actions({
              action: (constructor) =>
                property((key) =>
                  constructor(
                    mapValues(
                      this.extendableSignals.currentValue,
                      (signal) => ({
                        update: (predicate, config = {}) => {
                          const callbacks = new Map<
                            string,
                            UnaryFunction<unknown, void>
                          >();

                          this.transform.parse(key, (event) => ({
                            ...event,
                            predicate: signal.pull(
                              predicate(
                                Serializable.parse(event.data.args ?? null),
                              ),
                            ),
                            callback: callbacks.get(event.id),
                          }));

                          return (args) =>
                            new Promise<unknown>((callback) =>
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
                      }),
                    ),
                  ),
                ),
            }),
      ),
    );
  }
}

export class StoreProvider<Data> extends ExtendableStoreAdapter<
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
