import { map, OperatorFunction, scan } from "rxjs";

export const sequence =
  <Input, Output>(
    predicate: (inputs: [Input, ...Input[]], outputs: Output[]) => Output,
  ): OperatorFunction<Input, Output> =>
  (source) =>
    source.pipe(
      scan(
        ({ inputs, outputs }, input) => ({
          inputs: [input],
          outputs: [predicate([input, ...inputs], outputs)],
        }),
        { inputs: new Array<Input>(), outputs: new Array<Output>() },
      ),
      map(({ outputs }) => {
        if (!(0 in outputs)) {
          throw new Error();
        }

        return outputs[0];
      }),
    );
