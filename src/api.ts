import {
  asArray,
  asFunction,
  LazyDictionary,
  MaybeArray,
  MaybeFunction,
} from "@cascateer/lib";
import {
  asObservable,
  MaybeObservable,
  ProxyObservable,
} from "@cascateer/lib/observable";
import { Dictionary, flow, Function1, Function2, intersection } from "lodash";
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
import { Action, ProxyEffect } from "./types";

type MemoizableTagsFactory<Args, Result> = MaybeFunction<
  [Args, Result],
  MaybeArray<string> | undefined
>;

class MemoizableTags<Args, Result> {
  predicate: Function2<Args, Result, string[]>;

  constructor(factory: MemoizableTagsFactory<Args, Result> = []) {
    this.predicate = flow(asFunction(factory), (tags = []) => asArray(tags));
  }
}

interface MemoizableConfig<Args, Result> {
  predicate: Function1<Args, MaybeObservable<Result>>;
  tags?: MemoizableTagsFactory<Args, Result>;
  invalidatesTags?: MemoizableTagsFactory<Args, Result>;
  persist?: boolean;
}

class Memoizable<Args, Result> {
  predicate: Function1<Args, Observable<Result>>;
  tags: MemoizableTags<Args, Result>;
  invalidatesTags: MemoizableTags<Args, Result>;

  subscribe: Function1<Subject<string[]>, ProxyEffect<Args, Result>>;

  share: Function1<NextObserver<string[]>, Action<Args, Result>>;

  constructor({
    predicate,
    tags,
    invalidatesTags,
    persist = true,
  }: MemoizableConfig<Args, Result>) {
    this.predicate = (args) => asObservable(predicate(args));
    this.tags = new MemoizableTags(tags);
    this.invalidatesTags = new MemoizableTags(invalidatesTags);

    this.subscribe = (invalidatedTags) => {
      const memoizedEffect: ProxyEffect<Args, Result> = memoize(
        (args) =>
          new ProxyObservable((pending) =>
            this.predicate(args).pipe(
              tap({
                next: (result) =>
                  invalidatedTags.next(
                    this.invalidatesTags.predicate(args, result),
                  ),
                subscribe: () => pending.next(true),
              }),
              finalize(() => pending.next(false)),
              repeat({
                delay: () =>
                  combineLatest([
                    memoizedEffect(args).pipe(
                      map((result) => this.tags.predicate(args, result)),
                    ),
                    invalidatedTags,
                  ]).pipe(
                    filter(
                      ([tags, invalidatedTags]) =>
                        intersection(tags, invalidatedTags).length > 0,
                    ),
                  ),
              }),
              shareReplay({ bufferSize: 1, refCount: !persist }),
            ),
          ),
      );

      return memoizedEffect;
    };

    this.share = (invalidatedTags) => (args) =>
      lastValueFrom(this.predicate(args)).then(
        (result) => (
          invalidatedTags.next(this.invalidatesTags.predicate(args, result)),
          result
        ),
      );
  }
}

export interface ApiEffect<Args, Result> extends ProxyEffect<Args, Result> {}

type ApiAdapterEffectConstructor<Source> = <Args, Result>(
  config: Function1<Source, MemoizableConfig<Args, Result>>,
) => ApiEffect<Args, Result>;

type ApiAdapterActionConstructor<Source> = <Args, Result>(
  config: Function1<
    Source,
    Omit<MemoizableConfig<Args, Result>, "tags" | "persist">
  >,
) => Action<Args, Result>;

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
      { effect: ApiAdapterEffectConstructor<Source> },
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
      { action: ApiAdapterActionConstructor<Source> },
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
