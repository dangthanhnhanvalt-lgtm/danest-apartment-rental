import { CatalogProvider } from "~/state/catalog";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "~/styles/globals.css";
import { RouterProvider } from "~/lib/router";
import { LanguageProvider } from "~/i18n/language-context";
import { AppStateProvider } from "~/state/app-state";
import { ToastProvider } from "~/components/ui/toast";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LanguageProvider>
      <RouterProvider>
        <CatalogProvider><AppStateProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AppStateProvider></CatalogProvider>
      </RouterProvider>
    </LanguageProvider>
  </StrictMode>,
);
