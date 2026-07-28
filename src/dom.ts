import { createFragment } from "@cascateer/core/jsx-runtime";
import { isObject, memoize } from "lodash";

export const insertNodes = <T extends Node>(...nodes: T[]) => ({
  before: (child: Node | null): T[] => {
    for (const node of nodes) {
      /**
       * // FIXME
       *
       * This should not be necessary. But somehow with empty elements (< />)
       * children started to appear that aren't Nodes, but of the kind
       *    {
       *        fileName: `{/**\/*.tsx}`;
       *        lineNumber: number;
       *        columnNumber: number;
       *    }
       *
       * This causes runtime errors of the kind
       *    "Uncaught TypeError: Failed to execute 'insertBefore' on 'Node': parameter 1 is not of type 'Node'."
       * that can be avoided by replacing
       *    <div />
       * , say, with
       *    <div>{null}</div>
       *  */
      if (node instanceof Node) {
        child?.parentNode?.insertBefore(node, child);
      } else {
        console.log(node);
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
