import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import tailwindcss from "@tailwindcss/vite";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import trackSourcePlugin from "./babel-plugin-track-source.js";

function sanitizeGeneratedHtml() {
  return {
    name: "sanitize-generated-html",
    enforce: "pre",
    apply: "build",
    transformIndexHtml: {
      order: "pre",
      handler(html: string) {
        let out = html;

        out = out.replace(/\s(src|href)=["']\s*["']/gi, "");

        out = out.replace(
          /<(img|script|source|video|audio|link)\b([^>]*?)\s(src|href)=["'](?:\/|\.\/|\.\.\/)["']([^>]*?)>/gi,
          "<$1$2$4>",
        );

        return out;
      },
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ["babel-plugin-react-compiler", trackSourcePlugin],
      },
    }),
    tailwindcss(),
    sanitizeGeneratedHtml() as Plugin,
  ],
  resolve: {
    alias: {
      "~": resolve(__dirname, "./src"),
    },
  },
});
