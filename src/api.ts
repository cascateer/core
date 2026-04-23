import {
  constant,
  Dictionary,
  intersectionWith,
  isEqual,
  isFunction,
  memoize,
  thru,
} from "lodash";
import objectHash from "object-hash";
import {
  BehaviorSubject,
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
  UnaryFunction,
} from "rxjs";
import { asObservable, ExtendableDictionary, property } from "./lib";
import { ProxyObservable } from "./observable";
import { Action, MaybeArray, MaybeObservable, ProxyEffect } from "./types";

interface TagsConstructor<Args, Result> {
  (args: Args, result: Result): string[];
}

interface MemoizableConfig<Args, Result> {
  predicate: UnaryFunction<Args, MaybeObservable<{ data: Result }>>;
  tags?: TagsConstructor<Args, Result> | MaybeArray<string>;
}

class Memoizable<Args, Result> {
  predicate: UnaryFunction<Args, Observable<Result>>;
  tags: TagsConstructor<Args, Result>;

  subscribe: UnaryFunction<Observable<string[]>, ProxyEffect<Args, Result>>;

  share: UnaryFunction<NextObserver<string[]>, Action<Args, Result>>;

  constructor({ predicate, tags }: MemoizableConfig<Args, Result>) {
    this.predicate = (args) =>
      asObservable(predicate(args)).pipe(map(property("data")));
    this.tags = isFunction(tags) ? tags : constant([tags ?? []].flat());

    this.subscribe = (invalidatedTags) => {
      const memoizedEffect: ProxyEffect<Args, Result> = memoize(
        (args) =>
          thru(
            new BehaviorSubject(false),
            (pending) =>
              new ProxyObservable(
                this.predicate(args),
                (source) =>
                  source.pipe(
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
                            isEqual(
                              tags,
                              intersectionWith(tags, invalidatedTags),
                            ),
                          ),
                        ),
                    }),
                    shareReplay({ bufferSize: 1, refCount: false }),
                  ),
                pending,
              ),
          ),
        (args) => objectHash(args ?? null),
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
    config: UnaryFunction<Source, MemoizableConfig<Args, Result>>,
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

export class ExtendableApiAdapter<
  Source,
  Effects extends Dictionary<ApiEffect<any, any>>,
  Actions extends Dictionary<Action<any, any>>,
> {
  complete(): ApiAdapter<Effects, Actions> {
    return new ApiAdapter(
      this.extendableEffects.complete(),
      this.extendableActions.complete(),
    );
  }

  constructor(
    public context: {
      source: Source;
      invalidatedTags: Subject<string[]>;
    },
    private extendableEffects: ExtendableDictionary<
      ApiEffect<any, any>,
      Effects
    >,
    private extendableActions: ExtendableDictionary<Action<any, any>, Actions>,
  ) {}

  provideEffects<MoreEffects extends Dictionary<ApiEffect<any, any>>>(
    effects: UnaryFunction<
      { effect: ApiAdapterPropertyConstructor<Source, "effect"> },
      MoreEffects
    >,
  ) {
    return new ExtendableApiAdapter(
      this.context,
      this.extendableEffects.extend(
        () => () =>
          effects({
            effect: (config) =>
              new Memoizable(config(this.context.source)).subscribe(
                this.context.invalidatedTags,
              ),
          }),
      ),
      this.extendableActions,
    );
  }

  provideActions<MoreActions extends Dictionary<Action<any, any>>>(
    actions: UnaryFunction<
      { action: ApiAdapterPropertyConstructor<Source, "action"> },
      MoreActions
    >,
  ) {
    return new ExtendableApiAdapter(
      this.context,
      this.extendableEffects,
      this.extendableActions.extend(
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

export class ApiProvider<Source> extends ExtendableApiAdapter<Source, {}, {}> {
  constructor(source: Source) {
    super(
      {
        source,
        invalidatedTags: new Subject(),
      },
      new ExtendableDictionary({}),
      new ExtendableDictionary({}),
    );
  }
}
