import { LazyDictionary } from "@cascateer/lib";
import { Dictionary, kebabCase } from "lodash";
import { defer, share, UnaryFunction } from "rxjs";
import { createFragment } from ".";
import { ApiAdapter, ApiEffect } from "./api";
import { cssStyleSheets } from "./css";
import { defineCustomElement } from "./dom";
import { ComputedSignal } from "./signal";
import { asStoreEffects, StoreAdapter, StoreEffects } from "./store";
import { TerminalAdapter, TerminalEffect } from "./terminal";
import { Action, Effect } from "./types";

export class ComponentConstructor<Props extends JSX.Props> {
  constructor(public predicate: UnaryFunction<string, JSX.Component<Props>>) {}
}

export function createComponent(customElement?: string) {
  const withTemplate =
    <Styles extends Promise<unknown>[]>(...styles: Styles) =>
    <
      Context extends Dictionary<Effect<any, any> | Action<any, any>>,
      Props extends JSX.Props,
    >(
      constructor: (
        ctx: Context,
        ...classNames: { -readonly [K in keyof Styles]: Awaited<Styles[K]> }
      ) => JSX.Component<Props>,
    ) =>
      class extends ComponentConstructor<Props> {
        constructor(ctx: Context) {
          super(
            (key) => (props) =>
              createFragment({
                children: defer(() =>
                  Promise.all(styles).then((cssModules) =>
                    cssStyleSheets(cssModules).then((cssStyleSheets) => {
                      const element = constructor(ctx, ...cssModules)(props);

                      return customElement != null
                        ? new (defineCustomElement(
                            `${key}-${kebabCase(customElement)}`,
                          ))(element, cssStyleSheets)
                        : createFragment({
                            children: element,
                          }); /* TODO omit cssModules (whole workflow) */
                    }),
                  ),
                ).pipe(share()),
              }),
          );
        }
      };

  return {
    withStyles: <Styles extends Promise<unknown>[]>(...styles: Styles) => ({
      withTemplate: withTemplate(...styles),
    }),
    withTemplate: withTemplate(),
  };
}

export function createStandaloneComponent(customElement?: string) {
  const withTemplate =
    <Styles extends Promise<unknown>[]>(...styles: Styles) =>
    <Props extends JSX.Props>(
      constructor: (
        ...classNames: { -readonly [K in keyof Styles]: Awaited<Styles[K]> }
      ) => JSX.Component<Props>,
    ): JSX.Component<Props> =>
      new (createComponent(customElement)
        .withStyles(...styles)
        .withTemplate<{}, Props>((_, ...classNames) =>
          constructor(...classNames),
        ))({}).predicate("csc");

  return {
    withStyles: <Styles extends Promise<unknown>[]>(...styles: Styles) => ({
      withTemplate: withTemplate(...styles),
    }),
    withTemplate: withTemplate(),
  };
}

export class ComponentsAdapter<
  Components extends Dictionary<ComponentConstructor<any>>,
> {
  constructor(public components: Components) {}
}

export class LazyComponentsAdapter<
  StoreSignals extends Dictionary<ComputedSignal<any>>,
  StoreActions extends Dictionary<Action<any, any>>,
  ApiEffects extends Dictionary<ApiEffect<any, any>>,
  ApiActions extends Dictionary<Action<any, any>>,
  TerminalEffects extends Dictionary<TerminalEffect<any, any>>,
  TerminalActions extends Dictionary<Action<any, any>>,
  Components extends Dictionary<ComponentConstructor<any>>,
> {
  complete(): ComponentsAdapter<Components> {
    return new ComponentsAdapter(this.extendableComponents.complete());
  }

  constructor(
    public context: {
      store: StoreAdapter<StoreSignals, StoreActions>;
      api: ApiAdapter<ApiEffects, ApiActions>;
      terminal: TerminalAdapter<TerminalEffects, TerminalActions>;
    },
    private extendableComponents: LazyDictionary<
      ComponentConstructor<any>,
      Components
    >,
  ) {}

  provideComponents<
    MoreComponents extends Dictionary<ComponentConstructor<any>>,
  >(
    components: UnaryFunction<
      {
        component: <Props extends JSX.Props>(
          constructor: UnaryFunction<
            {
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
            ComponentConstructor<Props>
          >,
        ) => ComponentConstructor<Props>;
      },
      MoreComponents
    >,
  ) {
    return new LazyComponentsAdapter(
      this.context,
      this.extendableComponents.extend(
        () => () =>
          components({
            component: (constructor) =>
              constructor({
                store: {
                  effects: asStoreEffects(this.context.store.signals),
                  actions: this.context.store.actions,
                },
                api: {
                  effects: this.context.api.effects,
                  actions: this.context.api.actions,
                },
                terminal: {
                  effects: this.context.terminal.effects,
                  actions: this.context.terminal.actions,
                },
              }),
          }),
      ),
    );
  }
}

export class ComponentsProvider<
  StoreSignals extends Dictionary<ComputedSignal<any>>,
  StoreActions extends Dictionary<Action<any, any>>,
  ApiEffects extends Dictionary<ApiEffect<any, any>>,
  ApiActions extends Dictionary<Action<any, any>>,
  TerminalEffects extends Dictionary<TerminalEffect<any, any>>,
  TerminalActions extends Dictionary<Action<any, any>>,
> extends LazyComponentsAdapter<
  StoreSignals,
  StoreActions,
  ApiEffects,
  ApiActions,
  TerminalEffects,
  TerminalActions,
  {}
> {
  constructor(context: {
    store: StoreAdapter<StoreSignals, StoreActions>;
    api: ApiAdapter<ApiEffects, ApiActions>;
    terminal: TerminalAdapter<TerminalEffects, TerminalActions>;
  }) {
    super(context, new LazyDictionary({}));
  }
}
