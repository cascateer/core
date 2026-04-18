import { Dictionary, thru } from "lodash";
import { UnaryFunction } from "rxjs";
import { ApiAdapter, ApiEffect } from "./api";
import { ExtendableDictionary } from "./lib";
import { ComputedSignal } from "./observable";
import { asStoreEffects, StoreAdapter, StoreEffects } from "./store";
import {
  Action,
  AsyncEffect,
  AsyncEffectInterceptor,
  AsyncEffects,
  Effect,
} from "./types";

export interface TerminalEffect<Args, Result> extends AsyncEffect<
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
                effects: AsyncEffects<ApiEffects>;
              };
              terminal: {
                effects: AsyncEffects<Effects>;
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
              const interceptor = new AsyncEffectInterceptor();

              return thru(
                constructor({
                  store: {
                    effects: asStoreEffects(this.context.store.signals),
                  },
                  api: {
                    effects: interceptor.intercept(this.context.api.effects),
                  },
                  terminal: {
                    effects: interceptor.intercept(currentEffects),
                  },
                }),
                interceptor.toAsyncEffect,
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
