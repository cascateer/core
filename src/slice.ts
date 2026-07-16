import { LazyDictionary } from "@cascateer/lib";
import { Dictionary, kebabCase, mapValues } from "lodash";
import { defer, map, share, UnaryFunction } from "rxjs";
import { createFragment } from ".";
import { ApiAdapter, ApiEffect } from "./api";
import {
  ComponentConstructor,
  ComponentsAdapter,
  ComponentsProvider,
} from "./component";
import { cssStyleSheets } from "./css";
import { defineCustomElement } from "./dom";
import { multicast, MulticastSubject } from "./operators";
import { ComputedSignal } from "./signal";
import {
  asStoreEffects,
  StoreAdapter,
  StoreEffects,
  StoreProvider,
} from "./store";
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

interface SliceConfigProps<
  Data,
  StoreSignals extends Dictionary<ComputedSignal<any>>,
  StoreActions extends Dictionary<Action<any, any>>,
  ApiEffects extends Dictionary<ApiEffect<any, any>>,
  ApiActions extends Dictionary<Action<any, any>>,
  TerminalEffects extends Dictionary<TerminalEffect<any, any>>,
  TerminalActions extends Dictionary<Action<any, any>>,
  Components extends Dictionary<ComponentConstructor<any>>,
> {
  key: Promise<string>;
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

class SliceConfig<
  Data,
  StoreSignals extends Dictionary<ComputedSignal<any>>,
  StoreActions extends Dictionary<Action<any, any>>,
  ApiEffects extends Dictionary<ApiEffect<any, any>>,
  ApiActions extends Dictionary<Action<any, any>>,
  TerminalEffects extends Dictionary<TerminalEffect<any, any>>,
  TerminalActions extends Dictionary<Action<any, any>>,
  Components extends Dictionary<ComponentConstructor<any>>,
> {
  slice: Slice<
    Data,
    StoreSignals,
    StoreActions,
    ApiEffects,
    ApiActions,
    TerminalEffects,
    TerminalActions,
    Components
  >;

  constructor(
    config: SliceConfigProps<
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
    this.slice = new Slice(config);
  }

  createComponent(customElement?: string) {
    const withTemplate =
      <Styles extends Promise<unknown>[]>(...styles: Styles) =>
      <Props extends JSX.Props>(
        constructor: (
          ctx: {
            store: {
              effects: StoreEffects<StoreSignals>;
              actions: StoreActions;
            };
            api: {
              effects: ApiEffects;
              actions: ApiActions;
            };
            terminal: {
              effects: TerminalEffects;
              actions: TerminalActions;
            };
          },
          ...classNames: { -readonly [K in keyof Styles]: Awaited<Styles[K]> }
        ) => JSX.Component<Props>,
      ) =>
      (props: Props) =>
        createFragment({
          children: defer(() =>
            Promise.all(styles).then((cssModules) =>
              cssStyleSheets(cssModules).then(async (cssStyleSheets) => {
                const element = constructor(
                  {
                    store: {
                      effects: asStoreEffects(this.slice.store.signals),
                      actions: this.slice.store.actions,
                    },
                    api: {
                      effects: this.slice.api.effects,
                      actions: this.slice.api.actions,
                    },
                    terminal: {
                      effects: this.slice.terminal.effects,
                      actions: this.slice.terminal.actions,
                    },
                  },
                  ...cssModules,
                )(props);

                return customElement != null
                  ? new (defineCustomElement(
                      `${await this.slice.key}-${kebabCase(customElement)}`,
                    ))(element, cssStyleSheets)
                  : createFragment({
                      children: element,
                    }); /* TODO omit cssModules (whole workflow) */
              }),
            ),
          ).pipe(share()),
        });

    return {
      withStyles: <Styles extends Promise<unknown>[]>(...styles: Styles) => ({
        withTemplate: withTemplate(...styles),
      }),
      withTemplate: withTemplate(),
    };
  }
}

export const createSlice = (key: Promise<string>) => () => ({
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
            > =>
              new SliceConfig({
                key,
                data,
                store,
                api,
                terminal,
                components,
                template,
              }),
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
  public key: Promise<string>;
  public data: Data;
  public store: StoreAdapter<StoreSignals, StoreActions>;
  public api: SliceConfigApi<ApiEffects, ApiActions>;
  public terminal: TerminalAdapter<TerminalEffects, TerminalActions>;

  actions: MulticastSubject;
  render: () => JSX.Element;

  constructor({
    key,
    data,
    store,
    api,
    terminal,
    components,
    template,
  }: SliceConfigProps<
    Data,
    StoreSignals,
    StoreActions,
    ApiEffects,
    ApiActions,
    TerminalEffects,
    TerminalActions,
    Components
  >) {
    this.key = key;
    this.data = data;
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

    this.api = api;

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

export class LazySliceAdapter<
  Slices extends Dictionary<Slice<any, any, any, any, any, any, any, any>>,
> {
  complete(): SliceAdapter<Slices> {
    return new SliceAdapter(this.lazySlices.complete());
  }

  constructor(
    private lazySlices: LazyDictionary<
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
            SliceConfigProps<
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
    return new LazySliceAdapter(
      this.lazySlices.extend(
        () =>
          ({ property }) =>
            slices({
              slice: (config) => property(() => new Slice(config())),
            }),
      ),
    );
  }
}

export class SliceProvider extends LazySliceAdapter<{}> {
  constructor() {
    super(new LazyDictionary({}));
  }
}
