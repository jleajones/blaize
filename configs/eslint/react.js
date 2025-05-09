// eslint/react.js
import baseConfig from "./base.js";

export default [
  ...baseConfig,
  {
    plugins: ["react", "react-hooks", "jsx-a11y"],
    languageOptions: {
      globals: {
        React: "readonly",
        JSX: "readonly",
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: "detect",
      },
      "jsx-a11y": {
        components: {
          // You can add custom component mappings here
          // For example: Image: 'img', Button: 'button'
        },
      },
    },
    rules: {
      // React 18+ settings
      "react/react-in-jsx-scope": "off", // Not needed in React 18+
      "react/prop-types": "off", // Use TypeScript for prop validation
      "react/require-default-props": "off", // TypeScript handles this better
      "react/display-name": "error",
      "react/jsx-uses-react": "off", // Not needed with new JSX transform
      "react/jsx-uses-vars": "error",

      // Hooks - critical for preventing bugs
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // JSX - enforce consistent practices
      "jsx-quotes": ["error", "prefer-double"],
      "react/jsx-boolean-value": ["error", "never"],
      "react/jsx-curly-brace-presence": [
        "error",
        { props: "never", children: "never" },
      ],
      "react/jsx-pascal-case": "error",
      "react/self-closing-comp": "error",
      "react/jsx-fragments": ["error", "syntax"],
      "react/jsx-no-useless-fragment": "error",
      "react/jsx-key": ["error", { checkFragmentShorthand: true }],
      "react/jsx-no-duplicate-props": "error",
      "react/jsx-no-target-blank": "error",
      "react/jsx-no-undef": "error",
      "react/no-array-index-key": "warn",
      "react/no-danger": "warn",
      "react/no-danger-with-children": "error",
      "react/no-deprecated": "error",
      "react/no-direct-mutation-state": "error",
      "react/no-unescaped-entities": "error",
      "react/no-unknown-property": "error",
      "react/no-unsafe": "error",

      // Accessibility - essential for inclusive UI
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/anchor-has-content": "error",
      "jsx-a11y/anchor-is-valid": "error",
      "jsx-a11y/aria-activedescendant-has-tabindex": "error",
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/aria-proptypes": "error",
      "jsx-a11y/aria-role": "error",
      "jsx-a11y/aria-unsupported-elements": "error",
      "jsx-a11y/click-events-have-key-events": "warn",
      "jsx-a11y/heading-has-content": "error",
      "jsx-a11y/html-has-lang": "error",
      "jsx-a11y/img-redundant-alt": "error",
      "jsx-a11y/interactive-supports-focus": "warn",
      "jsx-a11y/label-has-associated-control": "error",
      "jsx-a11y/media-has-caption": "warn",
      "jsx-a11y/mouse-events-have-key-events": "warn",
      "jsx-a11y/no-access-key": "error",
      "jsx-a11y/no-autofocus": "warn",
      "jsx-a11y/no-noninteractive-element-interactions": "warn",
      "jsx-a11y/no-noninteractive-tabindex": "warn",
      "jsx-a11y/no-redundant-roles": "error",
      "jsx-a11y/role-has-required-aria-props": "error",
      "jsx-a11y/role-supports-aria-props": "error",
      "jsx-a11y/tabindex-no-positive": "warn",
    },
  },
];
