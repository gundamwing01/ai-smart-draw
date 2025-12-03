import { defineConfig } from "@opennextjs/cloudflare";

export default defineConfig({
  // Next.js app root
  appPath: ".",
  cloudflare: {
    // Target Cloudflare Pages (can also be switched to "workers" later)
    pages: {
      // Directory Wrangler will deploy; keep in sync with wrangler.toml
      buildOutputDirectory: ".open-next",
      compatibilityDate: "2024-09-01",
      nodejsCompat: true,
    },
  },
  // Pass through env vars that are read at runtime on the server.
  // Add more keys here as you introduce them.
  env: [
    "OPENAI_API_KEY",
    "OPENAI_MODEL",
    "OPENAI_BASE_URL",
    "OPENAI_MAX_OUTPUT_TOKENS",
    "PLANTUML_RENDER_BASE",
    "KROKI_RENDER_BASE",
  ],
});
