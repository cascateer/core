import { fromEvent, map, Observable, OperatorFunction } from "rxjs";
import { property } from "../lib";

export const exchangeWith =
  <InMessage, OutMessage>(
    port: MessagePort,
  ): OperatorFunction<OutMessage, InMessage> =>
  (messages) =>
    new Observable<InMessage>((subscriber) => {
      fromEvent<MessageEvent<any>>(port, "message")
        .pipe(map(property("data")))
        .subscribe(subscriber);

      port.start();

      subscriber.add({
        unsubscribe: () => port.close(),
      });

      return messages.subscribe({
        next: (message) => port.postMessage(message),
      });
    });
