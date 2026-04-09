import { isObject, isString, once, tap } from "lodash";
import { nonNullable } from "./lib";

const cssImports = once(() =>
  Promise.all(
    [
      ...Object.entries(import.meta.glob("/**/*.*css")),
      ...Object.entries(import.meta.glob("/**/*.*css", { query: "?inline" })),
    ].map(([url, load]) =>
      load().then(async (module) => {
        const DEFAULT_KEY = "default";

        return {
          url,
          module,
          styleSheet:
            isObject(module) &&
            DEFAULT_KEY in module &&
            isString(module[DEFAULT_KEY])
              ? await new CSSStyleSheet().replace(module[DEFAULT_KEY])
              : null,
        };
      }),
    ),
  ).then((imports) =>
    imports.reduce(
      (imports, { url, module, styleSheet }) =>
        tap(imports, ({ urls, styleSheets }) => {
          urls.set(module, url);
          styleSheets.set(
            url,
            (styleSheets.get(url) ?? []).concat(styleSheet ?? []),
          );
        }),
      {
        urls: new Map<unknown, string>(),
        styleSheets: new Map<string, CSSStyleSheet[]>(),
      },
    ),
  ),
);

export const cssStyleSheets = (modules: unknown[]) =>
  cssImports().then(({ urls, styleSheets }) =>
    modules.flatMap(
      (module) => styleSheets.get(nonNullable(urls.get(module))) ?? [],
    ),
  );
