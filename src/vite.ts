import { createServer, loadEnv } from "vite";
import sassDts from "vite-plugin-sass-dts";

export const createDevServer = async () => {
  const { VITE_HOST, VITE_PORT } = loadEnv("development", process.cwd());

  const server = await createServer({
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

    resolve: {
      alias: {
        "@cascateer/test": "/test",
      },
    },

    server: {
      host: VITE_HOST,
      port: VITE_PORT != null ? +VITE_PORT : void 0,
    },
  });

  return server.listen();
};

createDevServer();
