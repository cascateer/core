import { ReplaySubject } from "rxjs";
import { ProxySubject } from "../observable";
import { ProxySubjectHandler } from "../observable/ProxySubject";

export const proxyReplaySubject = <T, U = T>(
  handler: ProxySubjectHandler<T, U>,
) => new ProxySubject(new ReplaySubject<T>(), handler);
