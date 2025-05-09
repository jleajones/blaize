// eslint/next.js
import reactConfig from "./react.js";

export default [
  ...reactConfig,
  {
    plugins: ["@next/next"],
    rules: {
      // Next.js specific rules
      "@next/next/no-html-link-for-pages": "error",
      "@next/next/no-img-element": "error",
      "@next/next/no-unwanted-polyfillio": "warn",
      "@next/next/no-sync-scripts": "error",
      "@next/next/no-script-component-in-head": "error",
      "@next/next/no-page-custom-font": "warn",
      "@next/next/no-css-tags": "error",
      "@next/next/no-title-in-document-head": "error",
      "@next/next/no-typos": "error",
      "@next/next/no-duplicate-head": "error",
      "@next/next/inline-script-id": "error",
      "@next/next/google-font-display": "warn",
      "@next/next/google-font-preconnect": "error",
      "@next/next/no-head-import-in-document": "error",
      "@next/next/no-before-interactive-script-outside-document": "error",
    },
  },
];
