import gsap from "gsap";

// Literal dari transkrip video referensi "murmura" — jangan diubah tanpa sepengetahuan reviewer.
// Pill = layer overlay seukuran container; yang "terlihat" cuma area clip-path di sekitar tab aktif.
export function slidePill(pill: HTMLElement, target: HTMLElement, animate = true) {
const W = pill.offsetWidth, H = pill.offsetHeight;
const L = target.offsetLeft, R = W - (L + target.offsetWidth);
const T = target.offsetTop, B = H - (T + target.offsetHeight);
const clip = (l: number, r: number) => `inset(${T}px ${r}px ${B}px ${l}px round 999px)`;
const prev = (pill as any).__lr;
(pill as any).__lr = [L, R];
if (!animate || !prev) return gsap.set(pill, { clipPath: clip(L, R) });
const o = { l: prev[0], r: prev[1] }, right = L > prev[0];
const draw = () => gsap.set(pill, { clipPath: clip(o.l, o.r) });
gsap.to(o, { l: L, duration: right ? 0.55 : 0.36,
ease: right ? 'power3.inOut' : 'power3.out', onUpdate: draw });
gsap.to(o, { r: R, duration: right ? 0.36 : 0.55,
ease: right ? 'power3.out' : 'power3.inOut', onUpdate: draw });
}
