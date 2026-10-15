const domain = import.meta.env.VITE_COGNITO_DOMAIN;
const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
const issuer = import.meta.env.VITE_COGNITO_ISSUER;

const pendingKey = "tickdesk-cognito-pending";
const sessionKey = "tickdesk-cognito-session";

function randomString(length = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return base64url(bytes);
}

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function callbackUrl() {
  return `${window.location.origin}/auth/callback`;
}

function checkConfig() {
  if (!domain || !clientId || !issuer) {
    throw new Error("Cognito environment configuration is missing.");
  }
}

function decodePayload(jwt) {
  const encoded = jwt.split(".")[1];
  if (!encoded) throw new Error("Invalid token response.");

  const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));

  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function beginCognitoLogin() {
  checkConfig();

  const verifier = randomString(32);
  const state = randomString(24);
  const nonce = randomString(24);

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier)
  );

  const challenge = base64url(new Uint8Array(digest));

  sessionStorage.setItem(pendingKey, JSON.stringify({
    verifier,
    state,
    nonce,
    createdAt: Date.now()
  }));

  const url = new URL("/oauth2/authorize", domain);

  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", callbackUrl());
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");

  window.location.assign(url.toString());
}

export async function finishCognitoLogin() {
  checkConfig();

  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const returnedState = params.get("state");
  const oauthError = params.get("error");

  // Remove the one-time authorization code from browser history.
  window.history.replaceState({}, "", window.location.pathname);

  if (oauthError) {
    throw new Error("Cognito sign-in was cancelled or rejected.");
  }

  const saved = sessionStorage.getItem(pendingKey);
  sessionStorage.removeItem(pendingKey);

  if (!saved || !code) {
    throw new Error("Missing login state or authorization code.");
  }

  const pending = JSON.parse(saved);

  if (
    returnedState !== pending.state ||
    Date.now() - pending.createdAt > 10 * 60 * 1000
  ) {
    throw new Error("Login state is invalid or expired.");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    code,
    redirect_uri: callbackUrl(),
    code_verifier: pending.verifier
  });

  const response = await fetch(
    `${domain}/oauth2/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    }
  );

  if (!response.ok) {
    throw new Error(`Cognito token exchange failed (${response.status}).`);
  }

  const tokens = await response.json();

  if (!tokens.id_token || !tokens.access_token) {
    throw new Error("Cognito did not return the required tokens.");
  }

  const claims = decodePayload(tokens.id_token);

  if (
    claims.iss !== issuer ||
    claims.aud !== clientId ||
    claims.token_use !== "id" ||
    claims.nonce !== pending.nonce ||
    typeof claims.exp !== "number" ||
    claims.exp * 1000 <= Date.now()
  ) {
    throw new Error("Unexpected Cognito token claims.");
  }

  const session = {
    email: claims.email || "",
    groups: claims["cognito:groups"] || [],
    subject: claims.sub,
    accessToken: tokens.access_token,
    idToken: tokens.id_token,
    expiresAt: Date.now() + tokens.expires_in * 1000
  };

  sessionStorage.setItem(sessionKey, JSON.stringify(session));

  return {
    email: session.email,
    groups: session.groups
  };
}

export function getCognitoSession() {
  const raw = sessionStorage.getItem(sessionKey);

  if (!raw) return null;

  try {
    const session = JSON.parse(raw);

    if (
      !session?.accessToken ||
      !Number.isFinite(session.expiresAt) ||
      session.expiresAt <= Date.now() + 10000
    ) {
      sessionStorage.removeItem(sessionKey);
      return null;
    }

    return session;
  } catch {
    sessionStorage.removeItem(sessionKey);
    return null;
  }
}

export function clearCognitoSession() {
  sessionStorage.removeItem(sessionKey);
  sessionStorage.removeItem(pendingKey);
}

export function beginCognitoLogout() {
  checkConfig();
  clearCognitoSession();

  const url = new URL("/logout", domain);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set(
    "logout_uri",
    `${window.location.origin}/`
  );

  window.location.assign(url.toString());
}
