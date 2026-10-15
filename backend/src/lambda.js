import serverless from "serverless-http";
import { createServer } from "./app.js";

// Fail closed: the cloud backend must never use
// development authentication or local JSON persistence.
if (
  process.env.AUTH_MODE !== "cognito" ||
  process.env.PERSISTENCE_BACKEND !== "dynamodb"
) {
  throw new Error(
    "Lambda requires AUTH_MODE=cognito and PERSISTENCE_BACKEND=dynamodb."
  );
}

for (const name of [
  "COGNITO_USER_POOL_ID",
  "COGNITO_CLIENT_ID",
  "TICKETS_TABLE",
  "COMMENTS_TABLE",
  "ACTIVITIES_TABLE"
]) {
  if (!process.env[name]) {
    throw new Error(`Missing Lambda configuration: ${name}`);
  }
}

// Wrap the existing HTTP server without listening on a port.
export const handler = serverless(createServer());
