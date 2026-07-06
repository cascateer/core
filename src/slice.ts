import { LazyDictionary } from "@cascateer/lib";
import { Dictionary, mapValues } from "lodash";
import { defer, map, share, UnaryFunction } from "rxjs";
import { createFragment } from ".";
import { ApiAdapter, ApiEffect } from "./api";
import {
  ComponentConstructor,
  ComponentsAdapter,
  ComponentsProvider,
} from "./component";
import { defineCustomElement } from "./dom";
import { multicast, MulticastSubject } from "./operators";
import { ComputedSignal } from "./signal";
import { StoreAdapter, StoreProvider } from "./store";
import { TerminalAdapter, TerminalEffect, TerminalProvider } from "./terminal";
import { Action } from "./types";

interface SliceConfigStore<
  Data,
  StoreSignals extends Dictionary<ComputedSignal<any>>,
  StoreActions extends Dictionary<Action<any, any>>,
> extends UnaryFunction<
  {
    StoreProvider: {
      new (): StoreProvider<Data>;
    };
  },
  StoreAdapter<StoreSignals, StoreActions>
> {}

interface SliceConfigApi<
  ApiEffects extends Dictionary<ApiEffect<any, any>>,
  ApiActions extends Dictionary<Action<any, any>>,
> extends ApiAdapter<ApiEffects, ApiActions> {}

interface SliceConfigTerminal<
  StoreSignals extends Dictionary<ComputedSignal<any>>,
  StoreActions extends Dictionary<Action<any, any>>,
  ApiEffects extends Dictionary<ApiEffect<any, any>>,
  ApiActions extends Dictionary<Action<any, any>>,
  TerminalEffects extends Dictionary<TerminalEffect<any, any>>,
  TerminalActions extends Dictionary<Action<any, any>>,
> extends UnaryFunction<
  {
    TerminalProvider: {
      new (): TerminalProvider<
        StoreSignals,
        StoreActions,
        ApiEffects,
        ApiActions
      >;
    };
  },
  TerminalAdapter<TerminalEffects, TerminalActions>
> {}

interface SliceConfigComponents<
  StoreSignals extends Dictionary<ComputedSignal<any>>,
  StoreActions extends Dictionary<Action<any, any>>,
  ApiEffects extends Dictionary<ApiEffect<any, any>>,
  ApiActions extends Dictionary<Action<any, any>>,
  TerminalEffects extends Dictionary<TerminalEffect<any, any>>,
  TerminalActions extends Dictionary<Action<any, any>>,
  Components extends Dictionary<ComponentConstructor<any>>,
> extends UnaryFunction<
  {
    ComponentsProvider: {
      new (): ComponentsProvider<
        StoreSignals,
        StoreActions,
        ApiEffects,
        ApiActions,
        TerminalEffects,
        TerminalActions
      >;
    };
  },
  ComponentsAdapter<Components>
> {}

interface SliceConfigTemplate<
  Components extends Dictionary<ComponentConstructor<any>>,
> extends UnaryFunction<
  {
    [K in keyof Components]: ReturnType<
      <
        Props extends (Components[K] extends ComponentConstructor<infer Props>
          ? Props
          : never),
      >() => JSX.Component<Props>
    >;
  },
  JSX.Element
> {}

interface SliceConfig<
  Data,
  StoreSignals extends Dictionary<ComputedSignal<any>>,
  StoreActions extends Dictionary<Action<any, any>>,
  ApiEffects extends Dictionary<ApiEffect<any, any>>,
  ApiActions extends Dictionary<Action<any, any>>,
  TerminalEffects extends Dictionary<TerminalEffect<any, any>>,
  TerminalActions extends Dictionary<Action<any, any>>,
  Components extends Dictionary<ComponentConstructor<any>>,
> {
  data: Data;
  store: SliceConfigStore<Data, StoreSignals, StoreActions>;
  api: SliceConfigApi<ApiEffects, ApiActions>;
  terminal: SliceConfigTerminal<
    StoreSignals,
    StoreActions,
    ApiEffects,
    ApiActions,
    TerminalEffects,
    TerminalActions
  >;
  components: SliceConfigComponents<
    StoreSignals,
    StoreActions,
    ApiEffects,
    ApiActions,
    TerminalEffects,
    TerminalActions,
    Components
  >;
  template: SliceConfigTemplate<Components>;
}

export const createSlice = () => ({
  withData: <Data>(data: Data) => ({
    withStore: <
      StoreSignals extends Dictionary<ComputedSignal<any>>,
      StoreActions extends Dictionary<Action<any, any>>,
    >(
      store: SliceConfigStore<Data, StoreSignals, StoreActions>,
    ) => ({
      withApi: <
        ApiEffects extends Dictionary<ApiEffect<any, any>>,
        ApiActions extends Dictionary<Action<any, any>>,
      >(
        api: SliceConfigApi<ApiEffects, ApiActions>,
      ) => ({
        withTerminal: <
          TerminalEffects extends Dictionary<TerminalEffect<any, any>>,
          TerminalActions extends Dictionary<Action<any, any>>,
        >(
          terminal: SliceConfigTerminal<
            StoreSignals,
            StoreActions,
            ApiEffects,
            ApiActions,
            TerminalEffects,
            TerminalActions
          >,
        ) => ({
          withComponents: <
            Components extends Dictionary<ComponentConstructor<any>>,
          >(
            components: SliceConfigComponents<
              StoreSignals,
              StoreActions,
              ApiEffects,
              ApiActions,
              TerminalEffects,
              TerminalActions,
              Components
            >,
          ) => ({
            withTemplate: (
              template: SliceConfigTemplate<Components>,
            ): SliceConfig<
              Data,
              StoreSignals,
              StoreActions,
              ApiEffects,
              ApiActions,
              TerminalEffects,
              TerminalActions,
              Components
            > => ({ data, store, api, terminal, components, template }),
          }),
        }),
      }),
    }),
  }),
});

export class Slice<
  Data,
  StoreSignals extends Dictionary<ComputedSignal<any>>,
  StoreActions extends Dictionary<Action<any, any>>,
  ApiEffects extends Dictionary<ApiEffect<any, any>>,
  ApiActions extends Dictionary<Action<any, any>>,
  TerminalEffects extends Dictionary<TerminalEffect<any, any>>,
  TerminalActions extends Dictionary<Action<any, any>>,
  Components extends Dictionary<ComponentConstructor<any>>,
> {
  private store: StoreAdapter<StoreSignals, StoreActions>;
  private terminal: TerminalAdapter<TerminalEffects, TerminalActions>;

  actions: MulticastSubject;
  render: () => JSX.Element;

  constructor(
    public key: Promise<string>,
    {
      data,
      store,
      api,
      terminal,
      components,
      template,
    }: SliceConfig<
      Data,
      StoreSignals,
      StoreActions,
      ApiEffects,
      ApiActions,
      TerminalEffects,
      TerminalActions,
      Components
    >,
  ) {
    this.store = store({
      StoreProvider: ((context) =>
        class extends StoreProvider<Data> {
          constructor() {
            super(context);
          }
        })({
        actions: (this.actions = multicast(key, data)),
      }),
    });

    this.terminal = terminal({
      TerminalProvider: ((context) =>
        class extends TerminalProvider<
          StoreSignals,
          StoreActions,
          ApiEffects,
          ApiActions
        > {
          constructor() {
            super(context);
          }
        })({ api, store: this.store }),
    });

    this.render = () =>
      createFragment({
        children: defer(() => key).pipe(
          map(
            (key) =>
              new (defineCustomElement(`${key}-slice`))(
                template(
                  mapValues(
                    components({
                      ComponentsProvider: ((context) =>
                        class extends ComponentsProvider<
                          StoreSignals,
                          StoreActions,
                          ApiEffects,
                          ApiActions,
                          TerminalEffects,
                          TerminalActions
                        > {
                          constructor() {
                            super(context);
                          }
                        })({ store: this.store, api, terminal: this.terminal }),
                    }).components,
                    (componentConstructor) =>
                      componentConstructor.predicate(key),
                  ),
                ),
              ),
          ),
          share(),
        ),
      });
  }
}

export class SliceAdapter<
  Slices extends Dictionary<Slice<any, any, any, any, any, any, any, any>>,
> {
  constructor(public slices: Slices) {}
}

export class ExtendableSliceAdapter<
  Slices extends Dictionary<Slice<any, any, any, any, any, any, any, any>>,
> {
  complete(): SliceAdapter<Slices> {
    return new SliceAdapter(this.extendableSlices.complete());
  }

  constructor(
    private extendableSlices: LazyDictionary<
      Slice<any, any, any, any, any, any, any, any>,
      Slices
    >,
  ) {}

  provideSlices<
    MoreSlices extends Dictionary<
      Slice<any, any, any, any, any, any, any, any>
    >,
  >(
    slices: UnaryFunction<
      {
        slice: <
          Data,
          StoreSignals extends Dictionary<ComputedSignal<any>>,
          StoreActions extends Dictionary<Action<any, any>>,
          ApiEffects extends Dictionary<ApiEffect<any, any>>,
          ApiActions extends Dictionary<Action<any, any>>,
          TerminalEffects extends Dictionary<TerminalEffect<any, any>>,
          TerminalActions extends Dictionary<Action<any, any>>,
          Components extends Dictionary<ComponentConstructor<any>>,
        >(
          constructor: UnaryFunction<
            void,
            SliceConfig<
              Data,
              StoreSignals,
              StoreActions,
              ApiEffects,
              ApiActions,
              TerminalEffects,
              TerminalActions,
              Components
            >
          >,
        ) => Slice<
          Data,
          StoreSignals,
          StoreActions,
          ApiEffects,
          ApiActions,
          TerminalEffects,
          TerminalActions,
          Components
        >;
      },
      MoreSlices
    >,
  ) {
    return new ExtendableSliceAdapter(
      this.extendableSlices.extend(
        () =>
          ({ property }) =>
            slices({
              slice: (config) => property((key) => new Slice(key, config())),
            }),
      ),
    );
  }
}

export class SliceProvider extends ExtendableSliceAdapter<{}> {
  constructor() {
    super(new LazyDictionary({}));
  }
}
