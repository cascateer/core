import { bind, camelCase, isFunction, isObject } from "lodash";
import React, { CSSProperties } from "react";
import {
  combineLatest,
  fromEvent,
  map,
  ObservableInputTuple,
  Observer,
  UnaryFunction,
} from "rxjs";
import { ObservableFragment, Primitive } from "./fragment";
import { asArray, asObservable, keys } from "./lib";
import { sequence } from "./operators";
import {
  MaybeArray,
  MaybeObservable,
  MaybeObservableInputTuple,
} from "./types";

type DocumentEventListener<EventName extends keyof DocumentEventMap> =
  | Partial<Observer<DocumentEventMap[EventName]>>
  | UnaryFunction<DocumentEventMap[EventName], void>;

declare global {
  namespace JSX {
    type Element = MaybeObservable<Node | Primitive>;

    export type CSSCustomPropertyDefinition = Omit<PropertyDefinition, "name">;

    export type CSSCustomIntegerPropertyDefinition =
      CSSCustomPropertyDefinition & { syntax: "<integer>" };

    export interface CSSCustomPropertyDefinitions extends Record<
      keyof {},
      CSSCustomPropertyDefinition
    > {}

    type CSSCustomProperties = Record<
      keyof CSSCustomPropertyDefinitions & `--${string}`,
      string | number
    >;

    type Children = MaybeObservable<MaybeArray<Element>>;

    interface IntrinsicAttributes {
      children?: Children;
    }

    type IntrinsicElements = {
      [TagName in keyof HTMLElementTagNameMap]: IntrinsicAttributes & {
        [AttributeName in keyof Omit<
          React.JSX.IntrinsicElements[TagName],
          "children" | "dangerouslySetInnerHTML" | "ref"
        >]: AttributeName extends `on${infer ReactEventName}`
          ? Lowercase<ReactEventName> extends keyof DocumentEventMap
            ? DocumentEventListener<Lowercase<ReactEventName>>
            : never
          : MaybeObservable<
              AttributeName extends "className"
                ? MaybeArray<string>
                : AttributeName extends "style"
                  ? MaybeObservableInputTuple<
                      CSSProperties | CSSCustomProperties
                    >
                  : React.JSX.IntrinsicElements[TagName][AttributeName]
            >;
      };
    };

    type Props = Record<string, unknown>;

    interface Component<P extends Props = Props> {
      (props: IntrinsicAttributes & P): Element;
    }
  }
}

export const createFragment = ({ children }: JSX.IntrinsicAttributes) =>
  new ObservableFragment(children);

export const createElement = (
  component: JSX.Component | string,
  attributes: JSX.IntrinsicAttributes | null,
  ...tagContent: JSX.Children[]
): JSX.Element => {
  const { children: rawChildren = tagContent, ...propsWithoutChildren } =
      attributes ?? {},
    children = asArray(rawChildren).map((children) =>
      asObservable(children).pipe(
        map((children) => createFragment({ children })),
      ),
    );

  switch (typeof component) {
    case "function":
      return component({ ...propsWithoutChildren, children });
    case "string": {
      const element = document.createElement(component);

      for (const [name, value] of Object.entries(propsWithoutChildren)) {
        const eventName = name.match(/^on(.*)$/)?.[1]?.toLowerCase();

        if (eventName != null) {
          fromEvent(element, eventName).subscribe(
            ...(isFunction(value)
              ? [value]
              : isObject(value)
                ? [
                    [...keys(value)].reduce<Partial<Observer<unknown>>>(
                      (observer, key) => {
                        const observerKey = [
                          "next" as const,
                          "error" as const,
                          "complete" as const,
                        ].find((observerKey) => observerKey === key);

                        const observerValue = value[key];

                        if (observerKey != null && isFunction(observerValue)) {
                          observer[observerKey] = bind(observerValue, value);
                        }

                        return observer;
                      },
                      {},
                    ),
                  ]
                : []),
          );
        } else {
          asObservable(value).subscribe({
            next: (propertyValue) => {
              if (name === "className") {
                element.setAttribute(
                  "class",
                  String(propertyValue).replaceAll(",", " "),
                );
              } else if (name === "style") {
                if (isObject(propertyValue)) {
                  combineLatest(
                    Object.entries(propertyValue).reduce<
                      ObservableInputTuple<Record<string, unknown>>
                    >(
                      (style, [key, value]) => (
                        (style[key] = asObservable(value)),
                        style
                      ),
                      {},
                    ),
                  )
                    .pipe(
                      sequence(([style], [previousStyle]) => {
                        if (previousStyle != null) {
                          for (const name in previousStyle) {
                            element.style.removeProperty(name);
                          }
                        }

                        for (const [name, value] of Object.entries(style)) {
                          element.style.setProperty(name, String(value));
                        }

                        return style;
                      }),
                    )
                    .subscribe();
                }
              } else if (name.startsWith("data-")) {
                const camelCaseName = camelCase(name.replace(/^data/, ""));

                if (propertyValue == null) {
                  delete element.dataset[camelCaseName];
                } else {
                  element.dataset[camelCase(name.replace(/^data/, ""))] =
                    String(propertyValue);
                }
              } else if (name === "disabled" && !propertyValue) {
                element.removeAttribute(name);
              } else {
                element.setAttribute(name, String(propertyValue));
              }
            },
          });
        }
      }

      element.append(createFragment({ children }));

      return element;
    }
  }
};

export const Fragment = createFragment;
export const jsx = createElement;
export const jsxs = createElement;
