declare global {
  namespace Sample {
    interface Component extends JSX.Component<{}> {}

    export interface Components extends Record<keyof {}, Component> {}
  }
}

export class SampleRegistry {
  static components: Partial<Sample.Components> = {};

  static register(components: Partial<Sample.Components>) {
    this.components = {
      ...this.components,
      ...components,
    };
  }
}
