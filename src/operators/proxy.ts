import { Subject } from "rxjs";
import { ProxySubject } from "../observable";
import { ProxySubjectHandler } from "../observable/ProxySubject";

export const proxy = <T, U = T>(
  handler: ProxySubjectHandler<T, U>,
  target?: Subject<T>,
) => new ProxySubject(handler, target);
