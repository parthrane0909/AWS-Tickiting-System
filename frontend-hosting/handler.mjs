import { readFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "site");

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

export async function handler(event) {
  const method = event.requestContext?.http?.method || "GET";

  if (method !== "GET" && method !== "HEAD") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  let pathname;
  try {
    pathname = decodeURIComponent(event.rawPath || "/");
  } catch {
    return { statusCode: 400, body: "Invalid URL" };
  }

  if (
    !pathname.startsWith("/") ||
    pathname.includes("\\") ||
    pathname.includes("\0") ||
    pathname.split("/").includes("..")
  ) {
    return { statusCode: 400, body: "Invalid path" };
  }

  const requested = pathname === "/" ? "/index.html" : pathname;
  const extension = extname(requested).toLowerCase();

  let data;
  let servingIndex = false;

  try {
    data = readFileSync(join(root, requested));
  } catch {
    if (extension) {
      return { statusCode: 404, body: "Not found" };
    }

    data = readFileSync(join(root, "index.html"));
    servingIndex = true;
  }

  const responseExtension = servingIndex ? ".html" : extension;

  return {
    statusCode: 200,
    headers: {
      "Content-Type":
        mime[responseExtension] || "application/octet-stream",
      "Cache-Control":
        requested.startsWith("/assets/") && !servingIndex
          ? "public, max-age=31536000, immutable"
          : "no-cache",
      "X-Content-Type-Options": "nosniff"
    },
    isBase64Encoded: true,
    body: method === "HEAD" ? "" : data.toString("base64")
  };
}
