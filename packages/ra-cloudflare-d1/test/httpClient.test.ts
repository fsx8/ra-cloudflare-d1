import { describe, expect, it } from "vitest";
import { HttpError } from "ra-core";
import { httpClient } from "../src/httpClient";

function makeResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  const status = init.status ?? 200;
  const headers = new Headers(init.headers);
  if (body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers,
  });
}

function makeFetch(responses: Response[]): {
  fetchImpl: typeof fetch;
  calls: RequestInit[];
} {
  const calls: RequestInit[] = [];
  let idx = 0;
  const fetchImpl: typeof fetch = (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    calls.push(init ?? {});
    const res = responses[idx] ?? responses[responses.length - 1];
    idx++;
    return Promise.resolve(res);
  };
  return { fetchImpl, calls };
}

describe("httpClient", () => {
  it("sets Authorization Bearer header", async () => {
    const { fetchImpl, calls } = makeFetch([makeResponse({ ok: true })]);
    await httpClient("https://api.test/posts", undefined, {
      apiKey: "secret",
      fetchImpl,
    });
    const headers = new Headers(calls[0].headers);
    expect(headers.get("Authorization")).toBe("Bearer secret");
  });

  it("sets Content-Type when body is present and not already set", async () => {
    const { fetchImpl, calls } = makeFetch([makeResponse({ ok: true })]);
    await httpClient(
      "https://api.test/posts",
      { method: "POST", body: JSON.stringify({ a: 1 }) },
      { apiKey: "k", fetchImpl },
    );
    const headers = new Headers(calls[0].headers);
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("does not overwrite caller-provided Content-Type", async () => {
    const { fetchImpl, calls } = makeFetch([makeResponse({ ok: true })]);
    await httpClient(
      "https://api.test/posts",
      {
        method: "POST",
        body: "text",
        headers: { "Content-Type": "text/plain" },
      },
      { apiKey: "k", fetchImpl },
    );
    const headers = new Headers(calls[0].headers);
    expect(headers.get("Content-Type")).toBe("text/plain");
  });

  it("does not set Content-Type when no body", async () => {
    const { fetchImpl, calls } = makeFetch([makeResponse({ ok: true })]);
    await httpClient(
      "https://api.test/posts",
      { method: "GET" },
      {
        apiKey: "k",
        fetchImpl,
      },
    );
    const headers = new Headers(calls[0].headers);
    expect(headers.get("Content-Type")).toBeNull();
  });

  it("returns response when ok", async () => {
    const { fetchImpl } = makeFetch([makeResponse({ data: [] })]);
    const res = await httpClient("https://api.test/posts", undefined, {
      apiKey: "k",
      fetchImpl,
    });
    expect(res.ok).toBe(true);
    const json = (await res.json()) as { data: unknown[] };
    expect(json.data).toEqual([]);
  });

  it("throws HttpError with error message and body on failure", async () => {
    const errorBody = {
      error: { code: "NOT_FOUND", message: "Record not found" },
    };
    const { fetchImpl } = makeFetch([makeResponse(errorBody, { status: 404 })]);

    try {
      await httpClient("https://api.test/posts/1", undefined, {
        apiKey: "k",
        fetchImpl,
      });
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      const httpErr = err as HttpError;
      expect(httpErr.status).toBe(404);
      expect(httpErr.message).toBe("Record not found");
      expect(httpErr.body).toEqual(errorBody);
    }
  });

  it("falls back to statusText when error body has no message", async () => {
    const { fetchImpl } = makeFetch([
      new Response("internal error", {
        status: 500,
        statusText: "Internal Server Error",
      }),
    ]);

    try {
      await httpClient("https://api.test/posts", undefined, {
        apiKey: "k",
        fetchImpl,
      });
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      const httpErr = err as HttpError;
      expect(httpErr.status).toBe(500);
      expect(httpErr.message).toBe("Internal Server Error");
    }
  });

  it("falls back to 'Request failed' when statusText is empty", async () => {
    const { fetchImpl } = makeFetch([
      new Response("oops", { status: 502, statusText: "" }),
    ]);

    try {
      await httpClient("https://api.test/posts", undefined, {
        apiKey: "k",
        fetchImpl,
      });
      expect.fail("should have thrown");
    } catch (err) {
      const httpErr = err as HttpError;
      expect(httpErr.message).toBe("Request failed");
    }
  });
});
