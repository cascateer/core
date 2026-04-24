import { Observable, ReplaySubject, UnaryFunction } from "rxjs";
import { ProxySubject } from "../observable";

export const proxyReplaySubject = <X, Y = X>(
  descriptor: UnaryFunction<ReplaySubject<X>, Observable<Y>>,
) => new ProxySubject<X, Y, ReplaySubject<X>>(new ReplaySubject(), descriptor);
