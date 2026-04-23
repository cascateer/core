import { ReplaySubject } from "rxjs";
import { ProxySubject } from "../observable";
import { ProxyObservableHandler } from "../observable/ProxyObservable";

export const proxyReplaySubject = <T, R = T>(
  handler: ProxyObservableHandler<T, R>,
) => new ProxySubject<T, R>(new ReplaySubject(), handler);
