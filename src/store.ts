import { constant, Dictionary, mapValues, memoize, tap, thru } from "lodash";
import {
  identity,
  merge,
  mergeMap,
  NextObserver,
  Observable,
  ReplaySubject,
  shareReplay,
  UnaryFunction,
} from "rxjs";
import { ExtendableDictionary } from "./lib";
import { ComputedSignal, Signal } from "./observable";
import {
  flatMap,
  MulticastAction,
  MulticastSubject,
  sequence,
} from "./operators";
import { Action, Transform } from "./types";

export type StoreEffect<Result> = () => Signal<Result>;

export type StoreEffects<Signals extends Dictionary<ComputedSignal<any>>> = {
  [K in keyof Signals]: ReturnType<
    <
      Result extends Signals[K] extends ComputedSignal<infer Result>
        ? Result
        : never,
    >() => StoreEffect<Result>
  >;
};

export const asStoreEffects = <Signals extends Dictionary<ComputedSignal<any>>>(
  signals: Signals,
  observer?: NextObserver<Signal<any>>,
): StoreEffects<Signals> =>
  mapValues(signals, (signal) =>
    memoize(() => tap(signal.clone(), (value) => observer?.next(value))),
  );

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
    public context: {
      transform: UnaryFunction<
        Promise<string>,
        {
          share: UnaryFunction<
            {
              args: unknown;
              callback: UnaryFunction<unknown, void>;
              sameOrigin?: boolean;
            },
            void
          >;
          register: UnaryFunction<(args: any) => Transform<any>, void>;
        }
      >;
    },
    private extendableSignals: ExtendableDictionary<
      ComputedSignal<any>,
      Signals
    >,
    private extendableActions: ExtendableDictionary<Action<any, any>, Actions>,
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
      this.context,
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
                  T extends Signals[K] extends ComputedSignal<infer T>
                    ? T
                    : never,
                >(
                  predicate: UnaryFunction<Args, Transform<T>>,
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
      this.context,
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
                        update: (predicate, config = {}) =>
                          thru(this.context.transform(key), (transform) => {
                            transform.register((args) =>
                              signal.reflector.predicate(predicate(args)),
                            );

                            return (args) =>
                              new Promise<unknown>((callback) =>
                                transform.share({ args, callback, ...config }),
                              );
                          }),
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
                predicate: constant(event.data.seed),
              }
            : [],
        ),
      );

    const callbacks = new Map<string, UnaryFunction<unknown, void>>();

    super(
      {
        transform: (key) => ({
          share: ({ args, callback, sameOrigin }) =>
            actions.next(
              async ({ id }) => (
                callbacks.set(id, callback),
                {
                  id,
                  type: "transformAction",
                  data: {
                    key: await key,
                    args,
                  },
                  sameOrigin,
                }
              ),
            ),
          register: (transform) =>
            actions
              .pipe(
                mergeMap(async (event) => {
                  if (
                    event.type === "transformAction" &&
                    event.data.key === (await key)
                  ) {
                    return {
                      ...event,
                      predicate: transform(event.data.args),
                      callback: callbacks.get(event.id),
                    };
                  }

                  return [];
                }),
                flatMap(identity),
              )
              .subscribe(transformActions),
        }),
      },
      new ExtendableDictionary({
        data: new ComputedSignal({
          value: merge(seedActions, transformActions).pipe(
            sequence<MulticastAction<Data>, Data>(
              ([action, previousAction], [previousState]) => {
                console.log(action);

                if (action.type === "seedAction") {
                  return action.predicate();
                }

                if (
                  action.previousId !== previousAction?.id ||
                  previousState == null
                ) {
                  throw new Error();
                }

                return tap(action.predicate(previousState), (state) =>
                  action.callback?.call(null, state),
                );
              },
            ),
            shareReplay(1),
          ),
        }),
      }),
      new ExtendableDictionary({}),
    );
  }
}
