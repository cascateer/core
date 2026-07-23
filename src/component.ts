import { createFragment } from "@cascateer/core/jsx-runtime";
import { kebabCase } from "lodash";
import { defer, share } from "rxjs";
import { cssStyleSheets } from "./css";
import { defineCustomElement } from "./dom";
import { ObservableFragment } from "./fragment";

export function createComponent(key: string): (customElement?: string) => {
  withStyles: <Styles extends Promise<unknown>[]>(
    ...styles: Styles
  ) => {
    withTemplate: <Props extends JSX.Props>(
      constructor: (
        ...classNames: { -readonly [K in keyof Styles]: Awaited<Styles[K]> }
      ) => JSX.Component<Props>,
    ) => (props: Props) => ObservableFragment;
  };
  withTemplate: <Props extends JSX.Props>(
    constructor: () => JSX.Component<Props>,
  ) => (props: Props) => ObservableFragment;
};
export function createComponent<Context>(
  key: string,
  ctx: Context,
): (customElement?: string) => {
  withStyles: <Styles extends Promise<unknown>[]>(
    ...styles: Styles
  ) => {
    withTemplate: <Props extends JSX.Props>(
      constructor: (
        ctx: Context,
        ...classNames: { -readonly [K in keyof Styles]: Awaited<Styles[K]> }
      ) => JSX.Component<Props>,
    ) => (props: Props) => ObservableFragment;
  };
  withTemplate: <Props extends JSX.Props>(
    constructor: (ctx: Context) => JSX.Component<Props>,
  ) => (props: Props) => ObservableFragment;
};
export function createComponent<Context>(
  key: string,
  ctx?: Context,
): (customElement?: string) => {
  withStyles: <Styles extends Promise<unknown>[]>(
    ...styles: Styles
  ) => {
    withTemplate: <Props extends JSX.Props>(
      constructor: (
        ctx?: Context,
        ...classNames: { -readonly [K in keyof Styles]: Awaited<Styles[K]> }
      ) => JSX.Component<Props>,
    ) => (props: Props) => ObservableFragment;
  };
  withTemplate: <Props extends JSX.Props>(
    constructor: (ctx?: Context | undefined) => JSX.Component<Props>,
  ) => (props: Props) => ObservableFragment;
} {
  return (customElement?: string) => {
    const withTemplate =
      <Styles extends Promise<unknown>[]>(...styles: Styles) =>
      <Props extends JSX.Props>(
        constructor: (
          ctx?: Context,
          ...classNames: { -readonly [K in keyof Styles]: Awaited<Styles[K]> }
        ) => JSX.Component<Props>,
      ) =>
      (props: Props) =>
        createFragment({
          children: defer(() =>
            Promise.all(styles).then((cssModules) =>
              cssStyleSheets(cssModules).then((cssStyleSheets) => {
                const element = constructor(
                  ...(ctx != null ? [ctx] : []),
                  ...cssModules,
                )(props);

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
        });

    return {
      withStyles: <Styles extends Promise<unknown>[]>(...styles: Styles) => ({
        withTemplate: withTemplate(...styles),
      }),
      withTemplate: withTemplate(),
    };
  };
}

export function createStandaloneComponent(customElement?: string) {
  return createComponent("csc")(customElement);
}
