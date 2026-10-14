import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth.js";

const routes = [
  { path: "/login", name: "login", component: () => import("../pages/LoginPage.vue"), meta: { public: true } },
  { path: "/", name: "dashboard", component: () => import("../pages/DashboardPage.vue") },
  { path: "/tickets/new", name: "create", component: () => import("../pages/CreateTicketPage.vue") },
  { path: "/tickets/:id", name: "detail", component: () => import("../pages/TicketDetailPage.vue"), props: true },
  { path: "/:pathMatch(.*)*", name: "notfound", component: () => import("../pages/NotFoundPage.vue"), meta: { public: true } },
];

const router = createRouter({ history: createWebHistory(), routes });

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (!to.meta.public && !auth.isAuthed) return { name: "login", query: { next: to.fullPath } };
  if (to.name === "login" && auth.isAuthed) return { name: "dashboard" };
  // Agents work existing tickets; creating is a Customer-only operation
  // (also enforced by the backend — this guard is UX, not security).
  if (to.name === "create" && auth.isAgent) return { name: "dashboard" };
  return true;
});

export default router;
