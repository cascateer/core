import { LazyDictionary } from "@cascateer/lib";
import { Dictionary } from "lodash";
import { UnaryFunction } from "rxjs";
import { ApiAdapter, ApiEffect } from "./api";
import { ComputedSignal } from "./signal";
import { asStoreEffects, StoreAdapter, StoreEffects } from "./store";
import {
  Action,
  Effect,
  ProxyEffect,
  ProxyEffectInterceptor,
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
    private extendableEffects: LazyDictionary<
      TerminalEffect<any, any>,
      Effects
    >,
    private extendableActions: LazyDictionary<Action<any, any>, Actions>,
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
      this.extendableEffects.extend(
        (currentEffects) => () =>
          effects({
            effect: (constructor) => {
              const interceptor = new ProxyEffectInterceptor();
              const source = {
                store: {
                  effects: asStoreEffects(this.context.store.signals),
                },
                api: {
                  effects: interceptor.intercept(this.context.api.effects),
                },
                terminal: {
                  effects: interceptor.intercept(currentEffects),
                },
              };

              return interceptor.proxy(constructor(source));
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
    return new LazyTerminalAdapter(
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
> extends LazyTerminalAdapter<
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
    super(context, new LazyDictionary({}), new LazyDictionary({}));
  }
}
