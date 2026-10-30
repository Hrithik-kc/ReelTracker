import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "tests/unit/**/*.{test,spec}.ts",
      "tests/component/**/*.{test,spec}.ts",
      "tests/integration/**/*.{test,spec}.ts",
    ],
    environment: "happy-dom",
    environmentOptions: {
      happyDOM: {
        url: "https://www.instagram.com/",
      },
    },
  },
});
