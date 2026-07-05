import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTypescript,
  {
    ignores: [".next/**", ".worktrees/**", "node_modules/**", "out/**", "dist/**"],
  },
];

export default eslintConfig;
