import { describe, expect, it } from "vitest";
import { createD1DataProvider } from "../src/dataProvider";
import type { D1ProviderOptions } from "../src/types";

interface FetchCall {
  url: string;
  init: RequestInit | undefined;
}

function makeFetch(responses: Response[]): {
  fetchImpl: typeof fetch;
  calls: FetchCall[];
} {
  const calls: FetchCall[] = [];
  let idx = 0;
  const fetchImpl: typeof fetch = (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    calls.push({ url, init });
    const res = responses[idx] ?? responses[responses.length - 1];
    idx++;
    return Promise.resolve(res);
  };
  return { fetchImpl, calls };
}

function jsonResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers,
  });
}

function makeProvider(
  responses: Response[],
  opts?: Partial<D1ProviderOptions>,
): {
  provider: ReturnType<typeof createD1DataProvider>;
  calls: FetchCall[];
} {
  const { fetchImpl, calls } = makeFetch(responses);
  const provider = createD1DataProvider({
    apiUrl: "https://api.test/api",
    apiKey: "key",
    httpClient: fetchImpl,
    ...opts,
  });
  return { provider, calls };
}

describe("dataProvider", () => {
  it("sets supportAbortSignal flag", () => {
    const { provider } = makeProvider([]);
    expect(provider.supportAbortSignal).toBe(true);
  });

  describe("getList", () => {
    it("computes range from pagination and parses total from headers", async () => {
      const { provider, calls } = makeProvider([
        jsonResponse([{ id: 1, title: "A" }], {
          headers: { "Content-Range": "posts 0-0/42" },
        }),
      ]);

      const result = await provider.getList("posts", {
        pagination: { page: 1, perPage: 25 },
        sort: { field: "title", order: "ASC" },
        filter: {},
      });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(42);

      const sp = new URLSearchParams(calls[0].url.split("?")[1]);
      expect(JSON.parse(sp.get("range")!)).toEqual([0, 24]);
      expect(JSON.parse(sp.get("sort")!)).toEqual(["title", "ASC"]);
    });

    it("computes range for page 3 with perPage 10", async () => {
      const { provider, calls } = makeProvider([
        jsonResponse([], { headers: { "X-Total-Count": "0" } }),
      ]);

      await provider.getList("posts", {
        pagination: { page: 3, perPage: 10 },
        sort: { field: "id", order: "ASC" },
        filter: {},
      });

      const sp = new URLSearchParams(calls[0].url.split("?")[1]);
      expect(JSON.parse(sp.get("range")!)).toEqual([20, 29]);
    });

    it("applies client-side transforms", async () => {
      const { provider } = makeProvider(
        [jsonResponse([{ id: 1, is_featured: 1 }])],
        {
          transforms: { booleanFields: { posts: ["is_featured"] } },
        },
      );

      const result = await provider.getList("posts", {
        pagination: { page: 1, perPage: 25 },
        sort: { field: "id", order: "ASC" },
        filter: {},
      });

      expect(
        (result.data as Array<Record<string, unknown>>)[0].is_featured,
      ).toBe(true);
    });
  });

  describe("getOne", () => {
    it("fetches by id and applies transforms", async () => {
      const { provider, calls } = makeProvider(
        [jsonResponse({ id: 5, title: "X" })],
        { transforms: { dateFields: { posts: ["created_at"] } } },
      );

      const result = await provider.getOne("posts", { id: 5 });

      expect((result.data as { id: number }).id).toBe(5);
      expect(calls[0].url).toBe("https://api.test/api/posts/5");
    });
  });

  describe("getMany", () => {
    it("returns empty array for empty ids", async () => {
      const { provider, calls } = makeProvider([]);

      const result = await provider.getMany("posts", { ids: [] });

      expect(result.data).toEqual([]);
      expect(calls).toHaveLength(0);
    });

    it("sends id filter for non-empty ids", async () => {
      const { provider, calls } = makeProvider([
        jsonResponse([{ id: 1 }, { id: 2 }]),
      ]);

      const result = await provider.getMany("posts", { ids: [1, 2] });

      expect(result.data).toHaveLength(2);
      const sp = new URLSearchParams(calls[0].url.split("?")[1]);
      expect(JSON.parse(sp.get("filter")!)).toEqual({ id: [1, 2] });
    });
  });

  describe("create", () => {
    it("sends POST with body", async () => {
      const { provider, calls } = makeProvider([
        jsonResponse({ id: 1, title: "New" }, { status: 201 }),
      ]);

      const result = await provider.create("posts", {
        data: { title: "New" },
      });

      expect((result.data as { id: number }).id).toBe(1);
      expect(calls[0].init?.method).toBe("POST");
      expect(JSON.parse(calls[0].init?.body as string)).toEqual({
        title: "New",
      });
    });
  });

  describe("update", () => {
    it("sends PUT with body", async () => {
      const { provider, calls } = makeProvider([
        jsonResponse({ id: 1, title: "Updated" }),
      ]);

      const result = await provider.update("posts", {
        id: 1,
        data: { title: "Updated" },
        previousData: { id: 1, title: "Old" },
      });

      expect((result.data as { title: string }).title).toBe("Updated");
      expect(calls[0].init?.method).toBe("PUT");
      expect(calls[0].url).toBe("https://api.test/api/posts/1");
    });
  });

  describe("updateMany", () => {
    it("uses bulk endpoint by default", async () => {
      const { provider, calls } = makeProvider([
        jsonResponse({ data: [1, 2] }),
      ]);

      const result = await provider.updateMany("posts", {
        ids: [1, 2],
        data: { title: "X" },
      });

      expect(result.data).toEqual([1, 2]);
      expect(calls[0].init?.method).toBe("POST");
      expect(calls[0].url).toContain("__bulkUpdate");
    });

    it("falls back to individual PUTs when useBulkOperations=false", async () => {
      const { provider, calls } = makeProvider(
        [
          jsonResponse({ id: 1, title: "X" }),
          jsonResponse({ id: 2, title: "X" }),
        ],
        { useBulkOperations: false },
      );

      const result = await provider.updateMany("posts", {
        ids: [1, 2],
        data: { title: "X" },
      });

      expect(result.data).toEqual([1, 2]);
      expect(calls).toHaveLength(2);
      expect(calls[0].init?.method).toBe("PUT");
      expect(calls[1].init?.method).toBe("PUT");
    });
  });

  describe("delete", () => {
    it("sends DELETE and returns response data", async () => {
      const { provider, calls } = makeProvider([
        jsonResponse({ id: 1, title: "Deleted" }),
      ]);

      const result = await provider.delete("posts", { id: 1 });

      expect((result.data as { id: number }).id).toBe(1);
      expect(calls[0].init?.method).toBe("DELETE");
    });

    it("returns { id } when response body is null", async () => {
      const { provider } = makeProvider([jsonResponse(null)]);

      const result = await provider.delete("posts", { id: 42 });

      expect(result.data).toEqual({ id: 42 });
    });
  });

  describe("deleteMany", () => {
    it("uses bulk endpoint by default", async () => {
      const { provider, calls } = makeProvider([
        jsonResponse({ data: [1, 2] }),
      ]);

      const result = await provider.deleteMany("posts", {
        ids: [1, 2],
      });

      expect(result.data).toEqual([1, 2]);
      expect(calls[0].init?.method).toBe("POST");
      expect(calls[0].url).toContain("__bulkDelete");
    });

    it("falls back to individual DELETEs when useBulkOperations=false", async () => {
      const { provider, calls } = makeProvider(
        [jsonResponse({ id: 1 }), jsonResponse({ id: 2 })],
        { useBulkOperations: false },
      );

      const result = await provider.deleteMany("posts", {
        ids: [1, 2],
      });

      expect(result.data).toEqual([1, 2]);
      expect(calls).toHaveLength(2);
      expect(calls[0].init?.method).toBe("DELETE");
      expect(calls[1].init?.method).toBe("DELETE");
    });
  });

  describe("getManyReference", () => {
    it("adds target filter and parses total", async () => {
      const { provider, calls } = makeProvider([
        jsonResponse([{ id: 1, post_id: 5 }], {
          headers: { "X-Total-Count": "3" },
        }),
      ]);

      const result = await provider.getManyReference("comments", {
        target: "post_id",
        id: 5,
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
        filter: {},
      });

      expect(result.total).toBe(3);
      const sp = new URLSearchParams(calls[0].url.split("?")[1]);
      expect(JSON.parse(sp.get("filter")!)).toEqual({ post_id: 5 });
    });
  });

  describe("apiUrl trailing slash", () => {
    it("strips trailing slash from apiUrl", async () => {
      const { fetchImpl, calls } = makeFetch([jsonResponse({ id: 1 })]);
      const provider = createD1DataProvider({
        apiUrl: "https://api.test/api/",
        apiKey: "k",
        httpClient: fetchImpl,
      });

      await provider.getOne("posts", { id: 1 });

      expect(calls[0].url).toBe("https://api.test/api/posts/1");
    });
  });
});
