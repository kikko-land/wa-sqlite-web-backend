import { IRem } from "./types";

export function makeId() {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  for (let i = 0; i < 32; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }

  return result;
}

const randomInRange = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min)) + min;

export interface ITreeState {
  currentDepth: number;
  toGenerateIds: string[];
  childrenInRow: (depth: number) => number;
  allRems: IRem[];
  totalDepth: number;
}

const generateRemTree = (state: ITreeState): ITreeState => {
  const { currentDepth, toGenerateIds, childrenInRow, allRems } = state;

  if (currentDepth === -1) return state;

  const newChildrenIds: string[] = [];

  toGenerateIds.forEach((id) => {
    const newIds =
      currentDepth <= 0
        ? []
        : Array.from(Array(childrenInRow(state.totalDepth - currentDepth))).map(
            () => makeId()
          );

    newChildrenIds.push(...newIds);

    allRems.push({
      _id: id,
      content:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum",
      childrenIds: newIds,
      a: makeId(),
      b: makeId(),
      c: makeId(),
      d: makeId(),
      e: makeId(),
      f: makeId(),
      g: makeId(),
    });
  });

  return generateRemTree({
    currentDepth: currentDepth - 1,
    totalDepth: state.totalDepth,
    childrenInRow,
    toGenerateIds: newChildrenIds,
    allRems,
  });
};

export interface ITreeArgs {
  depth: number;
  childrenInRow: (depth: number) => number;
}

export const generateRootTree = (args: ITreeArgs) => {
  const rootId = makeId();
  const allRems = generateRemTree({
    currentDepth: args.depth,
    toGenerateIds: [rootId],
    childrenInRow: args.childrenInRow,
    allRems: [],
    totalDepth: args.depth,
  }).allRems;

  return {
    allRems,
    allRemsRefs: Object.fromEntries(allRems.map((r) => [r._id, r])),
    rootId,
  };
};
