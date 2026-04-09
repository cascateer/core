export const keys = <T>(value: T) => [
  ...{
    *[Symbol.iterator]() {
      for (const key in value) yield key;
    },
  },
];
