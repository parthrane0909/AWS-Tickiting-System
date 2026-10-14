import http from "node:http";
import { handleRequest } from "./handlers/tickets.js";

export function createServer() {
  return http.createServer((req, res) => {
    // Dev-only permissive CORS for localhost frontend.
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-methods", "GET,POST,PUT,OPTIONS");
    res.setHeader("access-control-allow-headers", "content-type,x-dev-user-id");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    handleRequest(req, res).catch(() => {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { message: "Internal server error." } }));
    });
  });
}
