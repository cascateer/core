import { isObject, memoize } from "lodash";
import { createFragment } from ".";

export const insertNodes = <T extends Node>(...nodes: T[]) => ({
  before: (child: Node | null): T[] => {
    for (const node of nodes) {
      try {
        child?.parentNode?.insertBefore(node, child);
      } catch (err) {
        console.log(
          "inserting",
          node,
          "of",
          nodes,
          "before",
          child,
          "of parent",
          child?.parentNode,
        );

        throw err;
      }
    }

    return nodes;
  },
});

export const removeNodes = <T extends Node>(...nodes: T[]) => {
  for (const node of nodes) {
    node.parentNode?.removeChild(node);
  }
};

export class CustomElement extends HTMLElement {
  constructor(children?: JSX.Children, styles: CSSStyleSheet[] = []) {
    super();

    const shadowRoot = this.attachShadow({ mode: "open" });

    shadowRoot.adoptedStyleSheets.push(...styles);
    shadowRoot.append(createFragment({ children }));
  }
}

export const defineCustomElement = memoize((key: string) => {
  const constructor = class extends CustomElement {};

  customElements.define(key, constructor);

  return constructor;
});

export const registerCustomProperties = (
  definitions: Partial<JSX.CSSCustomPropertyDefinitions>,
) => {
  for (const [name, definition] of Object.entries(definitions)) {
    if (isObject(definition) && "inherits" in definition) {
      CSS.registerProperty({
        ...definition,
        inherits: Boolean(definition.inherits),
        name,
      });
    }
  }
};
