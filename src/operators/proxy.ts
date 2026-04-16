import { Subject } from "rxjs";
import { ProxySubject } from "../observable";
import { ProxySubjectHandler } from "../observable/ProxySubject";

export const proxy = <T, U = T>(
  target: Subject<T>,
  handler: ProxySubjectHandler<T, U>,
) => new ProxySubject(target, handler);
