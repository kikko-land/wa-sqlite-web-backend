module.exports = {
  extends: ["./node_modules/@kikko-land/common-scripts/eslintrc.cjs"],
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 12,
    sourceType: "module",
    project: "./tsconfig.json",
  },
};
