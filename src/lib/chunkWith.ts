import { Comparator, uniqWith } from "lodash";

export const chunkWith = <T>(
  actions: T[],
  comparator?: Comparator<T>,
): T[][] => [
  ...{
    *[Symbol.iterator]() {
      const prevActions = new Array<T>();

      if (actions.length == 0) {
        return;
      }

      for (const action of actions) {
        if (uniqWith([...prevActions, action], comparator).length === 1) {
          prevActions.push(action);
        } else {
          yield prevActions.splice(0, prevActions.length, action);
        }
      }

      yield prevActions;
    },
  },
];
