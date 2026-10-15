import {
  CognitoIdentityProviderClient,
  ListUsersInGroupCommand
} from "@aws-sdk/client-cognito-identity-provider";

import {
  DEV_USERS,
  findDevUser
} from "./devUsers.js";

export function createAgentDirectory({
  mode = process.env.AUTH_MODE || "dev",
  userPoolId = process.env.COGNITO_USER_POOL_ID,
  client
} = {}) {
  if (mode === "dev") {
    return {
      async list() {
        return DEV_USERS
          .filter(user => user.role === "agent")
          .map(({ id, name, role }) => ({ id, name, role }));
      },

      async find(id) {
        const user = findDevUser(id);
        return user?.role === "agent" ? user : null;
      }
    };
  }

  if (mode !== "cognito") {
    throw new Error(`Unsupported authentication mode: ${mode}`);
  }

  if (!userPoolId) {
    throw new Error("COGNITO_USER_POOL_ID is required.");
  }

  const cognito = client || new CognitoIdentityProviderClient({
    region: userPoolId.split("_")[0]
  });

  async function list() {
    const agents = [];
    let nextToken;

    do {
      const response = await cognito.send(
        new ListUsersInGroupCommand({
          UserPoolId: userPoolId,
          GroupName: "Agent",
          Limit: 60,
          ...(nextToken ? { NextToken: nextToken } : {})
        })
      );

      for (const user of response.Users || []) {
        if (!user.Enabled || user.UserStatus !== "CONFIRMED") {
          continue;
        }

        const attributes = Object.fromEntries(
          (user.Attributes || []).map(
            attribute => [attribute.Name, attribute.Value]
          )
        );

        // Match the stable identity from verified JWT claims.
        if (!attributes.sub) continue;

        agents.push({
          id: attributes.sub,
          name: attributes.name ||
            attributes.email ||
            user.Username ||
            attributes.sub,
          role: "agent"
        });
      }

      nextToken = response.NextToken;
    } while (nextToken);

    return agents.sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }

  return {
    list,

    async find(id) {
      if (typeof id !== "string" || !id) return null;

      const agents = await list();
      return agents.find(agent => agent.id === id) || null;
    }
  };
}
