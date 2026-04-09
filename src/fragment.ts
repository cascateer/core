import { tap } from "lodash";
import {
  combineLatest,
  distinctUntilChanged,
  map,
  Observable,
  of,
  scan,
  share,
  shareReplay,
  startWith,
  Subscription,
  switchMap,
} from "rxjs";
import { asArray, asObservable } from "./lib";
import { flatMap } from "./operators";

export type Primitive =
  | string
  | number
  | bigint
  | boolean
  | symbol
  | null
  | undefined;

const isPrimitive = (value: unknown): value is Primitive =>
  ["string", "number", "bigint", "boolean", "symbol"].includes(typeof value) ||
  value == null;

const insert = <T extends Node>(...nodes: T[]) => ({
  before: (child: Node | null): T[] => {
    for (const node of nodes) {
      child?.parentNode?.insertBefore(node, child);
    }

    return nodes;
  },
});

const remove = <T extends Node>(...nodes: T[]) => {
  for (const node of nodes) {
    node.parentNode?.removeChild(node);
  }
};

class AnchorFragment extends DocumentFragment {
  appendAnchor(current?: Comment) {
    return {
      current,
      next: this.appendChild(new Comment("anchor")),
    };
  }

  anchor = new Observable<Node[]>((subscriber) => {
    const observer = tap(
      new MutationObserver((records) =>
        subscriber.next(records.flatMap((record) => [...record.removedNodes])),
      ),
      (observer) => observer.observe(this, { childList: true }),
    );

    return {
      unsubscribe: () => observer.disconnect(),
    };
  }).pipe(
    share(),
    scan((anchor, removedNodes) => {
      if (removedNodes.includes(anchor.next)) {
        if (anchor.current != null) {
          remove(anchor.current);
        }

        return this.appendAnchor(anchor.next);
      }

      return anchor;
    }, this.appendAnchor()),
    flatMap((anchor) => anchor.current ?? []),
    distinctUntilChanged(),
    shareReplay(1),
  );

  constructor() {
    super();

    this.anchor.subscribe();
  }
}

export class ObservableFragment extends AnchorFragment {
  subscription: Subscription;

  get nodes(): Observable<Node[]> {
    return asObservable(this.content).pipe(
      map(asArray),
      switchMap((elements) =>
        combineLatest(
          elements.map((element) =>
            asObservable(element).pipe(
              switchMap((element) =>
                element instanceof ObservableFragment
                  ? element.nodes
                  : of(
                      isPrimitive(element)
                        ? new Text(element?.toString())
                        : element,
                    ),
              ),
              startWith(),
            ),
          ),
        ),
      ),
      map((nodes) => nodes.flat()),
    );
  }

  constructor(private content: JSX.Children = []) {
    super();

    this.subscription = combineLatest([this.anchor, this.nodes])
      .pipe(
        scan(
          (currentNodes, [anchor, nextNodes]) => (
            remove(...currentNodes),
            insert(...nextNodes).before(anchor)
          ),
          new Array<Node>(),
        ),
      )
      .subscribe();
  }
}
