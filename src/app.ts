import { Dictionary, mapValues } from "lodash";
import { UnaryFunction } from "rxjs";
import { createFragment } from ".";
import { property } from "./lib";
import { Slice, SliceAdapter, SliceProvider } from "./slice";

export class App<
  Slices extends Dictionary<Slice<any, any, any, any, any, any, any, any>>,
> {
  slices: Slices;
  render: () => JSX.Element;

  constructor(
    slices: UnaryFunction<
      {
        SliceProvider: {
          new (): SliceProvider;
        };
      },
      SliceAdapter<Slices>
    >,
    render: UnaryFunction<Record<keyof Slices, JSX.Component>, JSX.Element>,
  ) {
    this.slices = slices({ SliceProvider }).slices;

    this.render = () => render(mapValues(this.slices, property("render")));
  }

  appendTo(node: HTMLElement) {
    return node.append(
      createFragment({
        children: this.render(),
      }),
    );
  }
}
