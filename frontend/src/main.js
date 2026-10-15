import { createApp } from "vue";
import { createPinia } from "pinia";
import { useAuthStore } from "./stores/auth.js";
import App from "./App.vue";
import router from "./router/index.js";
import "./style.css";

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);

async function start() {
  if (import.meta.env.VITE_AUTH_MODE === "cognito") {
    await useAuthStore(pinia).restoreCognitoSession();
  }

  app.use(router);
  await router.isReady();
  app.mount("#app");
}

start().catch((error) => {
  console.error("Application initialization failed:", error);
});
