import { MaybePromise } from "@cascateer/lib";
import puppeteer, { ElementHandle } from "puppeteer";

const { VITE_HOST, VITE_PORT } = import.meta.env;

export const evaluate = <T>(
  sample: keyof Sample.Components,
  callback: (handle: ElementHandle<Element>) => MaybePromise<T>,
) =>
  new Promise<T>(async (resolve) => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.goto(`http://${VITE_HOST}:${VITE_PORT}/test/?sample=${sample}`);
    await page.locator("#root").waitHandle().then(callback).then(resolve);

    browser.close();
  });
