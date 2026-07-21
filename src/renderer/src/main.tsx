import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/700.css";
import { App } from "./App";
import { AgentWindow } from "./AgentWindow";
import { AppProvider } from "./state/AppContext";
import { EditorWindow } from "./components/editor/EditorWindow";
import { I18nProvider } from "./i18n";
import { initTheme, applyTheme, applyThemeId } from "./lib/theme";
import "./theme/global.css";

initTheme();

void window.api.settings.getGeneral().then((g) => {
  if (g?.themeId) applyThemeId(g.themeId);
  else if (g?.theme === "dark" || g?.theme === "light") applyTheme(g.theme);
});

const hash = window.location.hash.replace(/^#/, "");
const isEditorWindow = hash === "editor";
const isAgentWindow = hash === "agent";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement,
);

if (isEditorWindow) {
  root.render(
    <React.StrictMode>
      <EditorWindow />
    </React.StrictMode>,
  );
} else if (isAgentWindow) {
  root.render(
    <React.StrictMode>
      <I18nProvider>
        <AppProvider>
          <AgentWindow />
        </AppProvider>
      </I18nProvider>
    </React.StrictMode>,
  );
} else {
  root.render(
    <React.StrictMode>
      <I18nProvider>
        <App />
      </I18nProvider>
    </React.StrictMode>,
  );
}
