import http from "node:http";
import { handleRequest } from "./handlers/tickets.js";

export function createServer() {
  return http.createServer((req, res) => {
    const cognitoMode = process.env.AUTH_MODE === "cognito";
    const origin = req.headers.origin;
    const allowedOrigins = (
      process.env.CORS_ORIGIN || "http://localhost:5173"
    ).split(",").map(value => value.trim()).filter(Boolean);

    if (cognitoMode) {
      if (origin && !allowedOrigins.includes(origin)) {
        res.writeHead(403);
        res.end();
        return;
      }

      if (origin) {
        res.setHeader("access-control-allow-origin", origin);
        res.setHeader("vary", "Origin");
      }
    } else {
      res.setHeader("access-control-allow-origin", "*");
    }

    res.setHeader(
      "access-control-allow-methods",
      "GET,POST,PUT,OPTIONS"
    );

    res.setHeader(
      "access-control-allow-headers",
      cognitoMode
        ? "content-type,authorization"
        : "content-type,x-dev-user-id"
    );

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    handleRequest(req, res).catch(() => {
      if (res.headersSent) {
        res.destroy();
        return;
      }

      res.writeHead(500, {
        "content-type": "application/json"
      });

      res.end(JSON.stringify({
        error: { message: "Internal server error." }
      }));
    });
  });
}
