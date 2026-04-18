import { ReplaySubject } from "rxjs";
import { ProxySubject } from "../observable";
import { ProxyObservableHandler } from "../observable/ProxyObservable";

export const proxyReplaySubject = <T, U = T>(
  handler: ProxyObservableHandler<T, U>,
) => new ProxySubject<T, U>(new ReplaySubject(), handler);
