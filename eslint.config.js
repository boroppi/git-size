import tseslint from "typescript-eslint";

const sourceFiles = ["src/**/*.ts", "tests/**/*.ts"];

export default tseslint.config(
  {
    ignores: ["dist/**", "coverage/**"],
  },
  ...tseslint.configs.recommended.map((config) => ({ ...config, files: sourceFiles })),
  {
    files: sourceFiles,
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.eslint.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-misused-promises": "off",
      "@typescript-eslint/no-floating-promises": "error",
    },
  },
);