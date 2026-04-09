import { identity, isObject, memoize } from "lodash";
import { createFragment } from ".";

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
}, identity);

export const defineCustomProperties = (
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
