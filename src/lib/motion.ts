import type { Transition } from "framer-motion"

/**
 * Presets de resorte alineados con "Designing Fluid Interfaces":
 * damping 1.0 (sin rebote) para UI estática, damping ~0.8 solo cuando
 * el gesto/acontecimiento ya aporta inercia.
 */
export const spring: Transition = { type: "spring", bounce: 0, duration: 0.34 }

export const springSnappy: Transition = {
  type: "spring",
  bounce: 0,
  duration: 0.22,
}

export const springMomentum: Transition = {
  type: "spring",
  bounce: 0.18,
  duration: 0.42,
}

export const springSoft: Transition = { type: "spring", bounce: 0, duration: 0.5 }

export const fade: Transition = { duration: 0.18, ease: [0.32, 0.72, 0, 1] }

export const listItem: Transition = {
  type: "spring",
  bounce: 0,
  duration: 0.3,
  delay: 0.02,
}