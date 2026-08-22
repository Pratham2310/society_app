const js = require("@eslint/js");

module.exports = [

  {
    ignores: ["node_modules/**", "coverage/**"],
  },

  js.configs.recommended,

  {
    files: ["backend/**/*.js"],

    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "commonjs",
      globals: {
        require: "readonly",
        module: "writable",
        exports: "writable",
        process: "readonly",
        console: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        Buffer: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        fetch: "readonly",
        URL: "readonly",
      },
    },

    rules: {
      // These are the rules that would have caught the startup bugs:
      // undefined identifiers (gateLogSchema, visitorApprovalCOntroller,
      // Res/Req casing) and duplicate object keys in module.exports.
      "no-undef": "error",
      "no-dupe-keys": "error",
      "no-dupe-class-members": "error",
      "no-redeclare": "error",
      "no-unreachable": "error",

      // Noise reduction — warn, don't block.
      "no-unused-vars": ["warn", {
        argsIgnorePattern: "^_|^next$",
        varsIgnorePattern: "^_",
      }],
      "no-empty": ["warn", { allowEmptyCatch: true }],
    },
  },

  {
    files: ["backend/tests/**/*.js"],
    languageOptions: {
      globals: {
        require: "readonly",
        module: "writable",
        exports: "writable",
        process: "readonly",
        console: "readonly",
        __dirname: "readonly",
        fetch: "readonly",
      },
    },
  },

];
