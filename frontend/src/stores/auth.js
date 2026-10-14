import { defineStore } from "pinia";

// Auth state only — the dev user behind localStorage. Phase 2 replaces
// selection with Cognito Hosted UI redirect + JWT session.
export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: JSON.parse(localStorage.getItem("tickdesk-dev-user") || "null"),
  }),
  getters: {
    isAuthed: (s) => !!s.user,
    isAgent: (s) => s.user?.role === "agent",
  },
  actions: {
    signIn(user) {
      this.user = user;
      localStorage.setItem("tickdesk-dev-user", JSON.stringify(user));
    },
    signOut() {
      this.user = null;
      localStorage.removeItem("tickdesk-dev-user");
    },
  },
});
