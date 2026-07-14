import React from "react";
import { createRoot } from "react-dom/client";
import { Admin, Resource } from "react-admin";
import { createD1DataProvider } from "ra-cloudflare-d1";
import { PostCreate, PostEdit, PostList } from "./posts";
import { UserCreate, UserEdit, UserList } from "./users";

const dataProvider = createD1DataProvider({
  apiUrl: import.meta.env.VITE_API_URL ?? "http://localhost:8787/api",
  apiKey: import.meta.env.VITE_API_KEY ?? "sk_replace_me",
});

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Admin dataProvider={dataProvider}>
      <Resource
        name="posts"
        list={PostList}
        edit={PostEdit}
        create={PostCreate}
      />
      <Resource
        name="users"
        list={UserList}
        edit={UserEdit}
        create={UserCreate}
      />
    </Admin>
  </React.StrictMode>,
);
