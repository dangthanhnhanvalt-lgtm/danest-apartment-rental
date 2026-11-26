
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "~/styles/globals.css";
import { RouterProvider } from "~/lib/router";
import { LanguageProvider } from "~/i18n/language-context";
import { AppStateProvider } from "~/state/app-state";
import { ToastProvider } from "~/components/ui/toast";

// Kiểm tra kết nối Supabase
import { testSupabase } from "./testSupabase";

console.log("MAIN.TSX ĐÃ CHẠY");
testSupabase();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LanguageProvider>
      <RouterProvider>
        <AppStateProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AppStateProvider>
      </RouterProvider>
    </LanguageProvider>
  </StrictMode>,
);
