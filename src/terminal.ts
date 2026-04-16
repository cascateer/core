import { Dictionary, mapValues, memoize, tap, thru } from "lodash";
import {
  combineLatest,
  distinct,
  map,
  NextObserver,
  switchMap,
  UnaryFunction,
} from "rxjs";
import { ApiAdapter, ApiEffect } from "./api";
import { ExtendableDictionary } from "./lib";
import { ComputedSignal, TapObservable } from "./observable";
import { concat, proxyReplaySubject } from "./operators";
import { asStoreEffects, StoreAdapter, StoreEffects } from "./store";
import { Action, Effect, TapEffect } from "./types";

export interface TerminalEffect<Args, Result> extends TapEffect<Args, Result> {}

type TerminalEffects<Effects extends Dictionary<TapEffect<any, any>>> = {
  [K in keyof Effects]: ReturnType<
    <
      Args extends Effects[K] extends TapEffect<infer Args, infer _>
        ? Args
        : never,
      Result extends Effects[K] extends TapEffect<infer _, infer Result>
        ? Result
        : never,
    >() => TerminalEffect<Args, Result>
  >;
};

const asTerminalEffects = <Effects extends Dictionary<TapEffect<any, any>>>(
  effects: Effects,
  observer?: NextObserver<TapObservable<any>>,
): TerminalEffects<Effects> =>
  mapValues(effects, (effect) =>
    memoize((args) => tap(effect(args), (value) => observer?.next(value))),
  );

export class TerminalAdapter<
  Effects extends Dictionary<TerminalEffect<any, any>>,
  Actions extends Dictionary<Action<any, any>>,
> {
  constructor(
    public effects: Effects,
    public actions: Actions,
  ) {}
}

export class ExtendableTerminalAdapter<
  StoreSignals extends Dictionary<ComputedSignal<any>>,
  StoreActions extends Dictionary<Action<any, any>>,
  ApiEffects extends Dictionary<ApiEffect<any, any>>,
  ApiActions extends Dictionary<Action<any, any>>,
  Effects extends Dictionary<TerminalEffect<any, any>>,
  Actions extends Dictionary<Action<any, any>>,
> {
  complete(): TerminalAdapter<Effects, Actions> {
    return new TerminalAdapter(
      this.extendableEffects.complete(),
      this.extendableActions.complete(),
    );
  }

  constructor(
    private context: {
      store: StoreAdapter<StoreSignals, StoreActions>;
      api: ApiAdapter<ApiEffects, ApiActions>;
    },
    private extendableEffects: ExtendableDictionary<
      TerminalEffect<any, any>,
      Effects
    >,
    private extendableActions: ExtendableDictionary<Action<any, any>, Actions>,
  ) {}

  provideEffects<MoreEffects extends Dictionary<TerminalEffect<any, any>>>(
    effects: UnaryFunction<
      {
        effect: <Args, Result>(
          constructor: UnaryFunction<
            {
              store: {
                effects: StoreEffects<StoreSignals>;
              };
              api: {
                effects: TerminalEffects<ApiEffects>;
              };
              terminal: {
                effects: TerminalEffects<Effects>;
              };
            },
            Effect<Args, Result>
          >,
        ) => TerminalEffect<Args, Result>;
      },
      MoreEffects
    >,
  ) {
    return new ExtendableTerminalAdapter(
      this.context,
      this.extendableEffects.extend(
        (currentEffects) => () =>
          effects({
            effect: (constructor) => {
              const deps = proxyReplaySubject<TapObservable<any>, boolean>(
                (deps) =>
                  deps.pipe(
                    distinct(),
                    concat(),
                    switchMap((dep) =>
                      combineLatest(dep.map((dep) => dep.loading)),
                    ),
                    map((values) => values.some(Boolean)),
                  ),
              );

              return thru(
                constructor({
                  store: {
                    effects: asStoreEffects(this.context.store.signals, deps),
                  },
                  api: {
                    effects: asTerminalEffects(this.context.api.effects, deps),
                  },
                  terminal: {
                    effects: asTerminalEffects(currentEffects, deps),
                  },
                }),
                (effect) => (args) => new TapObservable(effect(args), deps),
              );
            },
          }),
      ),
      this.extendableActions,
    );
  }

  provideActions<MoreActions extends Dictionary<Action<any, any>>>(
    actions: UnaryFunction<
      {
        action: <Args, Result>(
          constructor: UnaryFunction<
            {
              store: {
                effects: StoreEffects<StoreSignals>;
                actions: StoreActions;
              };
              api: {
                actions: ApiActions;
              };
              terminal: {
                effects: Effects;
                actions: Actions;
              };
            },
            Action<Args, Result>
          >,
        ) => Action<Args, Result>;
      },
      MoreActions
    >,
  ) {
    return new ExtendableTerminalAdapter(
      this.context,
      this.extendableEffects,
      this.extendableActions.extend(
        (currentActions) => () =>
          actions({
            action: (constructor) =>
              constructor({
                store: {
                  effects: asStoreEffects(this.context.store.signals),
                  actions: this.context.store.actions,
                },
                api: {
                  actions: this.context.api.actions,
                },
                terminal: {
                  effects: this.extendableEffects.currentValue,
                  actions: currentActions,
                },
              }),
          }),
      ),
    );
  }
}

export class TerminalProvider<
  StoreSignals extends Dictionary<ComputedSignal<any>>,
  StoreActions extends Dictionary<Action<any, any>>,
  ApiEffects extends Dictionary<ApiEffect<any, any>>,
  ApiActions extends Dictionary<Action<any, any>>,
> extends ExtendableTerminalAdapter<
  StoreSignals,
  StoreActions,
  ApiEffects,
  ApiActions,
  {},
  {}
> {
  constructor(context: {
    api: ApiAdapter<ApiEffects, ApiActions>;
    store: StoreAdapter<StoreSignals, StoreActions>;
  }) {
    super(context, new ExtendableDictionary({}), new ExtendableDictionary({}));
  }
}
