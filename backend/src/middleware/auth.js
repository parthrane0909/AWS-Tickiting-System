import { CognitoJwtVerifier } from "aws-jwt-verify";
import { findDevUser } from "../adapters/auth/devUsers.js";
import { unauthorized, forbidden } from "../utils/errors.js";

let verifier;

function getVerifier() {
  if (!verifier) {
    const userPoolId = process.env.COGNITO_USER_POOL_ID;
    const clientId = process.env.COGNITO_CLIENT_ID;

    if (!userPoolId || !clientId) {
      throw new Error("Cognito configuration is missing.");
    }

    verifier = CognitoJwtVerifier.create({
      userPoolId,
      clientId,
      tokenUse: "access"
    });
  }

  return verifier;
}

export function mapCognitoClaims(claims) {
  if (!claims?.sub) {
    throw unauthorized("Missing Cognito subject.");
  }

  const groups = claims["cognito:groups"] || [];

  const isAgent = groups.includes("Agent");
  const isCustomer = groups.includes("Customer");

  if (isAgent === isCustomer) {
    throw forbidden("Exactly one ticketing role is required.");
  }

  return {
    id: claims.sub,
    name: claims.username || claims.sub,
    role: isAgent ? "agent" : "customer"
  };
}

export async function authenticate(req) {
  const mode = process.env.AUTH_MODE || "dev";

  if (mode === "dev") {
    const id = req.headers["x-dev-user-id"];

    if (!id) {
      throw unauthorized("Missing development user header.");
    }

    const user = findDevUser(id);

    if (!user) {
      throw unauthorized("Unknown development user.");
    }

    return user;
  }

  if (mode !== "cognito") {
    throw unauthorized("Unsupported authentication mode.");
  }

  const authorization = req.headers.authorization || "";
  const match = /^Bearer ([^\s]+)$/i.exec(authorization);

  if (!match) {
    throw unauthorized("Cognito access token required.");
  }

  let claims;

  try {
    claims = await getVerifier().verify(match[1]);
  } catch {
    throw unauthorized("Invalid or expired Cognito access token.");
  }

  return mapCognitoClaims(claims);
}

export async function optionalUser(req) {
  try {
    return await authenticate(req);
  } catch {
    return null;
  }
}
