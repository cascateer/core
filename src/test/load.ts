import { createRoot } from "@cascateer/core";
import { keys } from "@cascateer/lib";
import { SampleRegistry } from "./sample";

export const load = async (
  sampleQuery: string | null = new URLSearchParams(window.location.search).get(
    "sample",
  ),
) => {
  const samples = import.meta.glob("/**/*.samples.tsx");

  for (const url in samples) {
    await samples[url]?.call(null);
  }

  const sample = keys(SampleRegistry.components).find(
    (key) => key === sampleQuery,
  );

  const root = Object.assign(document.createElement("div"), { id: "root" });

  document.body.replaceChildren(root);

  if (sample != null) {
    // @ts-expect-error
    createRoot(root).render(SampleRegistry.components[sample]?.call(null, {}));
  }
};
