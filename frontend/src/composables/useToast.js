import { ref } from "vue";

const toasts = ref([]);
let seq = 0;

export function useToast() {
  function push(message, kind = "info") {
    const id = ++seq;
    toasts.value.push({ id, message, kind });
    setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== id);
    }, 3500);
  }
  return { toasts, push };
}
