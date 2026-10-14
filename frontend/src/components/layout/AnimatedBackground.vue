<template>
  <!-- Fixed background layer. Pure CSS 3D: translucent pastel spheres
       drifting in a perspective scene + slowly rotating wireframe rings.
       pointer-events:none guarantees it never blocks interaction, and
       z-index:-1 keeps it behind every card, dialog, and control.
       Cards themselves are never transformed — the 3D effect exists
       only in this background layer. -->
  <div aria-hidden="true" class="scene">
    <div class="sphere sphere-lavender" />
    <div class="sphere sphere-blush" />
    <div class="sphere sphere-mint" />
    <div class="sphere sphere-blue" />
    <div class="ring ring-a" />
    <div class="ring ring-b" />
    <div class="dot dot-1" />
    <div class="dot dot-2" />
    <div class="dot dot-3" />
    <div class="dot dot-4" />
  </div>
</template>

<style scoped>
.scene {
  position: fixed;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
  perspective: 1000px;
  transform-style: preserve-3d;
}

/* --- Soft translucent 3D spheres (pastel palette) --- */
.sphere {
  position: absolute;
  border-radius: 50%;
  will-change: transform;
}
.sphere-lavender {
  width: 38rem;
  height: 38rem;
  left: -10rem;
  top: -8rem;
  background: radial-gradient(circle at 32% 30%, rgba(240, 234, 248, 0.95), rgba(227, 214, 245, 0.55) 55%, rgba(227, 214, 245, 0) 72%);
  animation: drift-a 28s ease-in-out infinite;
}
.sphere-blush {
  width: 32rem;
  height: 32rem;
  right: -9rem;
  top: 22%;
  background: radial-gradient(circle at 60% 35%, rgba(248, 232, 241, 0.95), rgba(240, 208, 228, 0.5) 55%, rgba(240, 208, 228, 0) 72%);
  animation: drift-b 34s ease-in-out infinite;
}
.sphere-mint {
  width: 30rem;
  height: 30rem;
  left: 18%;
  bottom: -12rem;
  background: radial-gradient(circle at 40% 40%, rgba(231, 244, 236, 0.95), rgba(198, 228, 211, 0.5) 55%, rgba(198, 228, 211, 0) 72%);
  animation: drift-c 30s ease-in-out infinite;
}
.sphere-blue {
  width: 24rem;
  height: 24rem;
  right: 14%;
  bottom: -6rem;
  background: radial-gradient(circle at 50% 35%, rgba(234, 242, 252, 0.95), rgba(196, 216, 240, 0.5) 55%, rgba(196, 216, 240, 0) 72%);
  animation: drift-a 38s ease-in-out infinite reverse;
}

/* --- Slowly rotating wireframe orbital rings --- */
.ring {
  position: absolute;
  border-radius: 50%;
  will-change: transform;
  transform-style: preserve-3d;
}
.ring-a {
  width: 46rem;
  height: 46rem;
  right: -12rem;
  top: 8%;
  border: 1.5px solid rgba(14, 124, 107, 0.16);
  box-shadow: 0 0 0 6px rgba(14, 124, 107, 0.04), inset 0 0 0 2px rgba(14, 124, 107, 0.05);
  animation: orbit 46s linear infinite;
}
.ring-b {
  width: 30rem;
  height: 30rem;
  left: -8rem;
  bottom: 4%;
  border: 1.5px solid rgba(119, 116, 135, 0.14);
  box-shadow: 0 0 0 5px rgba(119, 116, 135, 0.04), inset 0 0 0 2px rgba(119, 116, 135, 0.05);
  animation: orbit 60s linear infinite reverse;
}

/* --- Small ambient particles --- */
.dot {
  position: absolute;
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  background: rgba(14, 124, 107, 0.28);
  will-change: transform, opacity;
}
.dot-1 { left: 24%; top: 30%; animation: float-dot 18s ease-in-out infinite; }
.dot-2 { left: 58%; top: 18%; animation: float-dot 22s ease-in-out infinite 2s; background: rgba(14, 124, 107, 0.2); }
.dot-3 { left: 76%; top: 58%; animation: float-dot 20s ease-in-out infinite 4s; background: rgba(119, 116, 135, 0.25); }
.dot-4 { left: 38%; top: 74%; animation: float-dot 24s ease-in-out infinite 1s; background: rgba(14, 124, 107, 0.18); }

/* --- Keyframes: GPU-friendly transforms only --- */
@keyframes drift-a {
  0%, 100% { transform: translate3d(0, 0, -40px); }
  50% { transform: translate3d(3rem, 2.5rem, 10px); }
}
@keyframes drift-b {
  0%, 100% { transform: translate3d(0, 0, -60px); }
  50% { transform: translate3d(-2.5rem, 3rem, 0); }
}
@keyframes drift-c {
  0%, 100% { transform: translate3d(0, 0, -20px); }
  50% { transform: translate3d(2rem, -2rem, -10px); }
}
@keyframes orbit {
  from { transform: rotateX(72deg) rotateZ(0deg); }
  to { transform: rotateX(72deg) rotateZ(360deg); }
}
@keyframes float-dot {
  0%, 100% { transform: translate3d(0, 0, 0); opacity: 0.7; }
  50% { transform: translate3d(0.8rem, -1.2rem, 20px); opacity: 1; }
}

/* --- Smaller shapes on tablets/phones --- */
@media (max-width: 768px) {
  .sphere-lavender, .sphere-blush, .sphere-mint, .sphere-blue {
    width: 22rem;
    height: 22rem;
  }
  .ring-a { width: 30rem; height: 30rem; }
  .ring-b { width: 20rem; height: 20rem; }
  .dot { width: 0.35rem; height: 0.35rem; }
}

/* --- Reduced motion: static pastel scene --- */
@media (prefers-reduced-motion: reduce) {
  .sphere, .ring, .dot { animation: none; }
  .sphere-lavender, .sphere-blush, .sphere-mint, .sphere-blue { opacity: 0.6; }
}
</style>
