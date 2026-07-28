import { LazyDictionary } from "@cascateer/lib";
import { DerivedSignal } from "@cascateer/lib/observable";
import { Dictionary, Function1 } from "lodash";
import { ApiAdapter, ApiEffect } from "./api";
import { createComponent } from "./component";
import { multicast, MulticastSubject } from "./operators";
import { asStoreEffects, StoreAdapter, StoreProvider } from "./store";
import { TerminalAdapter, TerminalEffect, TerminalProvider } from "./terminal";
import { Action } from "./types";

interface SliceConfigStore<
  Data,
  StoreSignals extends Dictionary<DerivedSignal<Data, any>>,
  StoreActions extends Dictionary<Action<any, any>>,
> extends Function1<
  {
    StoreProvider: {
      new (): StoreProvider<Data>;
    };
  },
  StoreAdapter<Data, StoreSignals, StoreActions>
> {}

interface SliceConfigApi<
  ApiEffects extends Dictionary<ApiEffect<any, any>>,
  ApiActions extends Dictionary<Action<any, any>>,
> extends ApiAdapter<ApiEffects, ApiActions> {}

interface SliceConfigTerminal<
  Data,
  StoreSignals extends Dictionary<DerivedSignal<Data, any>>,
  StoreActions extends Dictionary<Action<any, any>>,
  ApiEffects extends Dictionary<ApiEffect<any, any>>,
  ApiActions extends Dictionary<Action<any, any>>,
  TerminalEffects extends Dictionary<TerminalEffect<any, any>>,
  TerminalActions extends Dictionary<Action<any, any>>,
> extends Function1<
  {
    TerminalProvider: {
      new (): TerminalProvider<
        Data,
        StoreSignals,
        StoreActions,
        ApiEffects,
        ApiActions
      >;
    };
  },
  TerminalAdapter<TerminalEffects, TerminalActions>
> {}

interface SliceConfigProps<
  Data,
  StoreSignals extends Dictionary<DerivedSignal<Data, any>>,
  StoreActions extends Dictionary<Action<any, any>>,
  ApiEffects extends Dictionary<ApiEffect<any, any>>,
  ApiActions extends Dictionary<Action<any, any>>,
  TerminalEffects extends Dictionary<TerminalEffect<any, any>>,
  TerminalActions extends Dictionary<Action<any, any>>,
> {
  key: string;
  data: Data;
  store: SliceConfigStore<Data, StoreSignals, StoreActions>;
  api: SliceConfigApi<ApiEffects, ApiActions>;
  terminal: SliceConfigTerminal<
    Data,
    StoreSignals,
    StoreActions,
    ApiEffects,
    ApiActions,
    TerminalEffects,
    TerminalActions
  >;
}

class SliceConfig<
  Data,
  StoreSignals extends Dictionary<DerivedSignal<Data, any>>,
  StoreActions extends Dictionary<Action<any, any>>,
  ApiEffects extends Dictionary<ApiEffect<any, any>>,
  ApiActions extends Dictionary<Action<any, any>>,
  TerminalEffects extends Dictionary<TerminalEffect<any, any>>,
  TerminalActions extends Dictionary<Action<any, any>>,
> {
  slice: Slice<
    Data,
    StoreSignals,
    StoreActions,
    ApiEffects,
    ApiActions,
    TerminalEffects,
    TerminalActions
  >;

  constructor(
    config: SliceConfigProps<
      Data,
      StoreSignals,
      StoreActions,
      ApiEffects,
      ApiActions,
      TerminalEffects,
      TerminalActions
    >,
  ) {
    this.slice = new Slice(config);
  }

  createComponent(customElement?: string) {
    return createComponent(this.slice.key, {
      store: {
        effects: asStoreEffects<Data, StoreSignals>(this.slice.store.signals),
        actions: this.slice.store.actions,
      },
      api: {
        effects: this.slice.api.effects,
        actions: this.slice.api.actions,
      },
      terminal: {
        effects: this.slice.terminal.effects,
        actions: this.slice.terminal.actions,
      },
    })(customElement);
  }
}

export const createSlice = (key: string) => ({
  withData: <Data>(data: Data) => ({
    withStore: <
      StoreSignals extends Dictionary<DerivedSignal<Data, any>>,
      StoreActions extends Dictionary<Action<any, any>>,
    >(
      store: SliceConfigStore<Data, StoreSignals, StoreActions>,
    ) => ({
      withApi: <
        ApiEffects extends Dictionary<ApiEffect<any, any>>,
        ApiActions extends Dictionary<Action<any, any>>,
      >(
        api: SliceConfigApi<ApiEffects, ApiActions>,
      ) => ({
        withTerminal: <
          TerminalEffects extends Dictionary<TerminalEffect<any, any>>,
          TerminalActions extends Dictionary<Action<any, any>>,
        >(
          terminal: SliceConfigTerminal<
            Data,
            StoreSignals,
            StoreActions,
            ApiEffects,
            ApiActions,
            TerminalEffects,
            TerminalActions
          >,
        ) =>
          new SliceConfig({
            key,
            data,
            store,
            api,
            terminal,
          }),
      }),
    }),
  }),
});

export class Slice<
  Data,
  StoreSignals extends Dictionary<DerivedSignal<Data, any>>,
  StoreActions extends Dictionary<Action<any, any>>,
  ApiEffects extends Dictionary<ApiEffect<any, any>>,
  ApiActions extends Dictionary<Action<any, any>>,
  TerminalEffects extends Dictionary<TerminalEffect<any, any>>,
  TerminalActions extends Dictionary<Action<any, any>>,
> {
  public key: string;
  public data: Data;
  public store: StoreAdapter<Data, StoreSignals, StoreActions>;
  public api: SliceConfigApi<ApiEffects, ApiActions>;
  public terminal: TerminalAdapter<TerminalEffects, TerminalActions>;

  actions: MulticastSubject;

  constructor({
    key,
    data,
    store,
    api,
    terminal,
  }: SliceConfigProps<
    Data,
    StoreSignals,
    StoreActions,
    ApiEffects,
    ApiActions,
    TerminalEffects,
    TerminalActions
  >) {
    this.key = key;
    this.data = data;
    this.store = store({
      StoreProvider: ((context) =>
        class extends StoreProvider<Data> {
          constructor() {
            super(context);
          }
        })({
        actions: (this.actions = multicast(key, data)),
      }),
    });

    this.api = api;

    this.terminal = terminal({
      TerminalProvider: ((context) =>
        class extends TerminalProvider<
          Data,
          StoreSignals,
          StoreActions,
          ApiEffects,
          ApiActions
        > {
          constructor() {
            super(context);
          }
        })({ api, store: this.store }),
    });
  }
}

export class SliceAdapter<
  Slices extends Dictionary<Slice<any, any, any, any, any, any, any>>,
> {
  constructor(public slices: Slices) {}
}

export class LazySliceAdapter<
  Slices extends Dictionary<Slice<any, any, any, any, any, any, any>>,
> {
  complete(): SliceAdapter<Slices> {
    return new SliceAdapter(this.lazySlices.complete());
  }

  constructor(
    private lazySlices: LazyDictionary<
      Slice<any, any, any, any, any, any, any>,
      Slices
    >,
  ) {}

  provideSlices<
    MoreSlices extends Dictionary<Slice<any, any, any, any, any, any, any>>,
  >(
    slices: Function1<
      {
        slice: <
          Data,
          StoreSignals extends Dictionary<DerivedSignal<Data, any>>,
          StoreActions extends Dictionary<Action<any, any>>,
          ApiEffects extends Dictionary<ApiEffect<any, any>>,
          ApiActions extends Dictionary<Action<any, any>>,
          TerminalEffects extends Dictionary<TerminalEffect<any, any>>,
          TerminalActions extends Dictionary<Action<any, any>>,
        >(
          constructor: Function1<
            void,
            SliceConfigProps<
              Data,
              StoreSignals,
              StoreActions,
              ApiEffects,
              ApiActions,
              TerminalEffects,
              TerminalActions
            >
          >,
        ) => Slice<
          Data,
          StoreSignals,
          StoreActions,
          ApiEffects,
          ApiActions,
          TerminalEffects,
          TerminalActions
        >;
      },
      MoreSlices
    >,
  ) {
    return new LazySliceAdapter(
      this.lazySlices.extend(
        () =>
          ({ property }) =>
            slices({
              slice: (config) => property(() => new Slice(config())),
            }),
      ),
    );
  }
}

export class SliceProvider extends LazySliceAdapter<{}> {
  constructor() {
    super(new LazyDictionary({}));
  }
}
