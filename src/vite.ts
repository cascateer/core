import { UserConfig } from "vite";
import sassDts from "vite-plugin-sass-dts";

export const config: UserConfig = {
  plugins: [
    sassDts({
      legacyFileFormat: true,
    }),
  ],

  oxc: {
    jsx: {
      runtime: "automatic",
      importSource: "@cascateer/core",
    },
  },

  css: {
    modules: {
      scopeBehaviour: "local",
      localsConvention: "camelCaseOnly",
    },
  },
};
