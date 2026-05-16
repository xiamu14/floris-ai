import { type as arkType } from "arktype";
import type { Tool } from "../types/tool.type";
import {
  createToolError,
  createToolSuccess,
  saveRawArtifact,
  truncateText,
} from "./workspace-tool-utils";

const HttpRequestInput = arkType({
  url: "string",
  "method?": "string",
  "headers?": "Record<string, string>",
  "body?": "string",
  "timeoutMs?": "number",
  "maxBodyChars?": "number",
});

export const httpRequestTool: Tool = {
  name: "http_request",
  description:
    "Makes an HTTP request and returns status, headers summary, and capped body preview.",
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string" },
      method: { type: "string" },
      headers: {
        type: "object",
        additionalProperties: { type: "string" },
      },
      body: { type: "string" },
      timeoutMs: { type: "number" },
      maxBodyChars: { type: "number" },
    },
    required: ["url"],
    additionalProperties: false,
  },
  async execute(input, context) {
    const parsed = HttpRequestInput(input);

    if (parsed instanceof arkType.errors) {
      return createToolError({
        summary: "http_request input validation failed.",
        message: String(parsed),
        filterId: "http-request-domain-filter",
      });
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        Math.min(parsed.timeoutMs ?? 10_000, 60_000)
      );
      const requestInit: RequestInit = {
        method: parsed.method ?? "GET",
        signal: controller.signal,
      };

      if (parsed.headers) {
        requestInit.headers = parsed.headers;
      }

      if (parsed.body !== undefined) {
        requestInit.body = parsed.body;
      }

      const response = await fetch(parsed.url, requestInit);

      clearTimeout(timeout);

      const body = await response.text();
      const contentType = response.headers.get("content-type") ?? "unknown";
      const bodyPreview = truncateText(
        body,
        Math.min(parsed.maxBodyChars ?? 6000, 40_000)
      );
      const rawOutput = [
        `${response.status} ${response.statusText}`,
        `content-type: ${contentType}`,
        "",
        body,
      ].join("\n");
      const contextContent = [
        `HTTP ${response.status} ${response.statusText}`,
        `content-type: ${contentType}`,
        `body-bytes: ${new TextEncoder().encode(body).byteLength}`,
        "",
        summarizeHttpBody(bodyPreview, contentType),
      ].join("\n");
      const artifacts = await saveRawArtifact(
        context,
        "http_request",
        rawOutput,
        contentType
      );

      return createToolSuccess({
        summary: `HTTP ${response.status} ${response.statusText}.`,
        display: contextContent,
        contextContent,
        rawContent: rawOutput,
        artifacts,
        filterId: "http-request-domain-filter",
        strategy: contentType.includes("json") ? "json_shape" : "tail_head",
        data: {
          status: response.status,
          statusText: response.statusText,
          contentType,
        },
      });
    } catch (error) {
      return createToolError({
        summary: "http_request failed.",
        message: error instanceof Error ? error.message : String(error),
        filterId: "http-request-domain-filter",
      });
    }
  },
};

function summarizeHttpBody(body: string, contentType: string): string {
  if (contentType.includes("json")) {
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      return body;
    }
  }

  if (contentType.includes("html")) {
    return body
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "");
  }

  return body;
}
