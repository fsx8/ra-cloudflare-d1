import React from "react";
import { createRoot } from "react-dom/client";
import { Admin, Resource, ListGuesser } from "react-admin";
import { createD1DataProvider } from "ra-cloudflare-d1";

const dataProvider = createD1DataProvider({
  apiUrl: import.meta.env.VITE_API_URL ?? "http://localhost:8787/api",
  apiKey: import.meta.env.VITE_API_KEY ?? "sk_replace_me",
});

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Admin dataProvider={dataProvider}>
      <Resource name="posts" list={ListGuesser} />
    </Admin>
  </React.StrictMode>,
);
