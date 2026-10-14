import { findDevUser } from "../adapters/auth/devUsers.js";
import { unauthorized } from "../utils/errors.js";

// Dev-only auth: identity comes from the x-dev-user-id header, never from a body userId.
export function authenticate(req) {
  const id = req.headers["x-dev-user-id"];
  if (!id) throw unauthorized("Missing x-dev-user-id header (local dev auth).");
  const user = findDevUser(id);
  if (!user) throw unauthorized("Unknown development user.");
  return user;
}

export function optionalUser(req) {
  try {
    return authenticate(req);
  } catch {
    return null;
  }
}
