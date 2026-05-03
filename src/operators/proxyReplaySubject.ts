import { Observable, ReplaySubject, UnaryFunction } from "rxjs";
import { ProxySubject } from "../observable";

export const proxyReplaySubject = <T, R = T>(
  project: UnaryFunction<Observable<T>, Observable<R>>,
) => new ProxySubject(new ReplaySubject<T>(), project);
