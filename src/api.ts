import {
  asArray,
  asFunction,
  asObservable,
  LazyDictionary,
  MaybeArray,
  MaybeFunction,
  MaybeObservable,
} from "@cascateer/lib";
import {
  Dictionary,
  flow,
  Function1,
  Function2,
  intersectionWith,
  isEqual,
} from "lodash";
import {
  combineLatest,
  filter,
  finalize,
  lastValueFrom,
  map,
  NextObserver,
  Observable,
  repeat,
  shareReplay,
  Subject,
  tap,
} from "rxjs";
import { memoize } from "./lib/memoize";
import { ProxyObservable } from "./observable";
import { Action, ProxyEffect } from "./types";

interface MemoizableConfig<Args, Result> {
  predicate: Function1<Args, MaybeObservable<Result>>;
  tags?: MaybeFunction<[Args, Result], MaybeArray<string>>;
}

class Memoizable<Args, Result> {
  predicate: Function1<Args, Observable<Result>>;
  tags: Function2<Args, Result, string[]>;

  subscribe: Function1<Observable<string[]>, ProxyEffect<Args, Result>>;

  share: Function1<NextObserver<string[]>, Action<Args, Result>>;

  constructor({ predicate, tags }: MemoizableConfig<Args, Result>) {
    this.predicate = (args) => asObservable(predicate(args));
    this.tags = flow(asFunction(tags ?? []), asArray);

    this.subscribe = (invalidatedTags) => {
      const memoizedEffect: ProxyEffect<Args, Result> = memoize(
        (args) =>
          new ProxyObservable((pending) =>
            this.predicate(args).pipe(
              tap({
                subscribe: () => pending.next(true),
              }),
              finalize(() => pending.next(false)),
              repeat({
                delay: () =>
                  combineLatest([
                    memoizedEffect(args).pipe(
                      map((result) => this.tags(args, result)),
                    ),
                    invalidatedTags,
                  ]).pipe(
                    filter(([tags, invalidatedTags]) =>
                      isEqual(tags, intersectionWith(tags, invalidatedTags)),
                    ),
                  ),
              }),
              shareReplay({ bufferSize: 1, refCount: false }),
            ),
          ),
      );

      return memoizedEffect;
    };

    this.share = (invalidatedTags) => (args) =>
      lastValueFrom(this.predicate(args)).then(
        (result) => (invalidatedTags.next(this.tags(args, result)), result),
      );
  }
}

export interface ApiEffect<Args, Result> extends ProxyEffect<Args, Result> {}

type ApiAdapterPropertyConstructor<Source, Type extends "effect" | "action"> = {
  [T in Type]: <Args, Result>(
    config: Function1<Source, MemoizableConfig<Args, Result>>,
  ) => T extends "effect" ? ApiEffect<Args, Result> : Action<Args, Result>;
}[Type];

export class ApiAdapter<
  Effects extends Dictionary<ApiEffect<any, any>>,
  Actions extends Dictionary<Action<any, any>>,
> {
  constructor(
    public effects: Effects,
    public actions: Actions,
  ) {}
}

export class LazyApiAdapter<
  Source,
  Effects extends Dictionary<ApiEffect<any, any>>,
  Actions extends Dictionary<Action<any, any>>,
> {
  complete(): ApiAdapter<Effects, Actions> {
    return new ApiAdapter(
      this.lazyEffects.complete(),
      this.lazyActions.complete(),
    );
  }

  constructor(
    public context: {
      source: Source;
      invalidatedTags: Subject<string[]>;
    },
    private lazyEffects: LazyDictionary<ApiEffect<any, any>, Effects>,
    private lazyActions: LazyDictionary<Action<any, any>, Actions>,
  ) {}

  provideEffects<MoreEffects extends Dictionary<ApiEffect<any, any>>>(
    effects: Function1<
      { effect: ApiAdapterPropertyConstructor<Source, "effect"> },
      MoreEffects
    >,
  ) {
    return new LazyApiAdapter(
      this.context,
      this.lazyEffects.extend(
        () => () =>
          effects({
            effect: (config) =>
              new Memoizable(config(this.context.source)).subscribe(
                this.context.invalidatedTags,
              ),
          }),
      ),
      this.lazyActions,
    );
  }

  provideActions<MoreActions extends Dictionary<Action<any, any>>>(
    actions: Function1<
      { action: ApiAdapterPropertyConstructor<Source, "action"> },
      MoreActions
    >,
  ) {
    return new LazyApiAdapter(
      this.context,
      this.lazyEffects,
      this.lazyActions.extend(
        () => () =>
          actions({
            action: (config) =>
              new Memoizable(config(this.context.source)).share(
                this.context.invalidatedTags,
              ),
          }),
      ),
    );
  }
}

export class ApiProvider<Source> extends LazyApiAdapter<Source, {}, {}> {
  constructor(source: Source) {
    super(
      {
        source,
        invalidatedTags: new Subject(),
      },
      new LazyDictionary({}),
      new LazyDictionary({}),
    );
  }
}
