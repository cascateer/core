import { LazyDictionary } from "@cascateer/lib";
import { DerivedSignal } from "@cascateer/lib/observable";
import { Dictionary, Function1, mapValues } from "lodash";
import { ApiAdapter, ApiEffect } from "./api";
import { asStoreEffects, StoreAdapter, StoreEffects } from "./store";
import {
  Action,
  combineProxyEffects,
  Effect,
  ProxyEffect,
  ProxyEffects,
} from "./types";

export interface TerminalEffect<Args, Result> extends ProxyEffect<
  Args,
  Result
> {}

export class TerminalAdapter<
  Effects extends Dictionary<TerminalEffect<any, any>>,
  Actions extends Dictionary<Action<any, any>>,
> {
  constructor(
    public effects: Effects,
    public actions: Actions,
  ) {}
}

export class LazyTerminalAdapter<
  Data,
  StoreSignals extends Dictionary<DerivedSignal<Data, any>>,
  StoreActions extends Dictionary<Action<any, any>>,
  ApiEffects extends Dictionary<ApiEffect<any, any>>,
  ApiActions extends Dictionary<Action<any, any>>,
  Effects extends Dictionary<TerminalEffect<any, any>>,
  Actions extends Dictionary<Action<any, any>>,
> {
  complete(): TerminalAdapter<Effects, Actions> {
    return new TerminalAdapter(
      this.lazyEffects.complete(),
      this.lazyActions.complete(),
    );
  }

  constructor(
    private context: {
      store: StoreAdapter<Data, StoreSignals, StoreActions>;
      api: ApiAdapter<ApiEffects, ApiActions>;
    },
    private lazyEffects: LazyDictionary<TerminalEffect<any, any>, Effects>,
    private lazyActions: LazyDictionary<Action<any, any>, Actions>,
  ) {}

  provideEffects<MoreEffects extends Dictionary<TerminalEffect<any, any>>>(
    effects: Function1<
      {
        effect: <Args, Result>(
          constructor: Function1<
            {
              store: {
                effects: StoreEffects<Data, StoreSignals>;
              };
              api: {
                effects: ProxyEffects<ApiEffects>;
              };
              terminal: {
                effects: ProxyEffects<Effects>;
              };
            },
            Effect<Args, Result>
          >,
        ) => TerminalEffect<Args, Result>;
      },
      MoreEffects
    >,
  ) {
    return new LazyTerminalAdapter(
      this.context,
      this.lazyEffects.extend(
        (currentEffects) => () =>
          effects({
            effect: (project) =>
              combineProxyEffects({
                intercept: (proxy) => ({
                  store: {
                    effects: asStoreEffects<Data, StoreSignals>(
                      this.context.store.signals,
                    ),
                  },
                  api: {
                    effects: mapValues(this.context.api.effects, proxy),
                  },
                  terminal: {
                    effects: mapValues(currentEffects, proxy),
                  },
                }),
                project,
              }),
          }),
      ),
      this.lazyActions,
    );
  }

  provideActions<MoreActions extends Dictionary<Action<any, any>>>(
    actions: Function1<
      {
        action: <Args, Result>(
          constructor: Function1<
            {
              store: {
                effects: StoreEffects<Data, StoreSignals>;
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
    return new LazyTerminalAdapter(
      this.context,
      this.lazyEffects,
      this.lazyActions.extend(
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
                  effects: this.lazyEffects.currentValue,
                  actions: currentActions,
                },
              }),
          }),
      ),
    );
  }
}

export class TerminalProvider<
  Data,
  StoreSignals extends Dictionary<DerivedSignal<Data, any>>,
  StoreActions extends Dictionary<Action<any, any>>,
  ApiEffects extends Dictionary<ApiEffect<any, any>>,
  ApiActions extends Dictionary<Action<any, any>>,
> extends LazyTerminalAdapter<
  Data,
  StoreSignals,
  StoreActions,
  ApiEffects,
  ApiActions,
  {},
  {}
> {
  constructor(context: {
    api: ApiAdapter<ApiEffects, ApiActions>;
    store: StoreAdapter<Data, StoreSignals, StoreActions>;
  }) {
    super(context, new LazyDictionary({}), new LazyDictionary({}));
  }
}
