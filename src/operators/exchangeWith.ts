import { fromEvent, map, Observable, OperatorFunction, tap } from "rxjs";
import { property } from "../lib";

export const exchangeWith =
  <InMessage, OutMessage>(
    port: MessagePort,
  ): OperatorFunction<OutMessage, InMessage> =>
  (messages) =>
    new Observable<InMessage>((subscriber) => {
      fromEvent<MessageEvent<any>>(port, "message")
        .pipe(
          tap((message) => console.log("exchange-in", message)),
          map(property("data")),
        )
        .subscribe(subscriber);

      port.start();

      subscriber.add({
        unsubscribe: () => port.close(),
      });

      return messages
        .pipe(tap((message) => console.log("exchange-out", message)))
        .subscribe({
          next: (message) => port.postMessage(message),
        });
    });
