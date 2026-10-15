import { defineStore } from "pinia";
import { api } from "../services/api.js";
import {
  getCognitoSession,
  clearCognitoSession
} from "../services/cognitoOAuth.js";

const cognitoMode =
  import.meta.env.VITE_AUTH_MODE === "cognito";

function loadDevUser() {
  try {
    return JSON.parse(
      localStorage.getItem("tickdesk-dev-user") || "null"
    );
  } catch {
    return null;
  }
}

export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: cognitoMode ? null : loadDevUser()
  }),

  getters: {
    isAuthed: (state) =>
      !!state.user &&
      (!cognitoMode || !!getCognitoSession()),

    isAgent: (state) =>
      state.user?.role === "agent"
  },

  actions: {
    signIn(user) {
      if (cognitoMode) {
        throw new Error(
          "Development login is disabled in Cognito mode."
        );
      }

      this.user = user;
      localStorage.setItem(
        "tickdesk-dev-user",
        JSON.stringify(user)
      );
    },

    async restoreCognitoSession() {
      if (!cognitoMode) return !!this.user;

      const session = getCognitoSession();

      if (!session) {
        this.user = null;
        return false;
      }

      try {
        // The backend verifies the Cognito JWT.
        const verified = await api.me();

        if (
          !verified ||
          verified.id !== session.subject ||
          !["customer", "agent"].includes(verified.role)
        ) {
          throw new Error("Invalid authenticated identity.");
        }

        // Email is used only as a display name.
        // Role and identity come from the verified backend.
        this.user = {
          ...verified,
          name: session.email || verified.name
        };

        return true;
      } catch {
        this.user = null;
        clearCognitoSession();
        return false;
      }
    },

    signOut() {
      this.user = null;
      localStorage.removeItem("tickdesk-dev-user");
      clearCognitoSession();
    }
  }
});
