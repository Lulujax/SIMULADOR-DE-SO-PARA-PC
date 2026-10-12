/** Física de gestos compartida por las ventanas (ver apple-design-skill). */

/** Resistencia progresiva en los bordes: nunca un tope brusco. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  const sign = Math.sign(overshoot)
  const magnitude = Math.abs(overshoot)
  return sign * ((magnitude * dimension * constant) / (dimension + constant * magnitude))
}

export interface Sample {
  t: number
  x: number
  y: number
}

/** Velocidad en px/s a partir de los últimos eventos de puntero. */
export function velocityFrom(samples: Sample[], windowMs = 120): { vx: number; vy: number } {
  if (samples.length < 2) return { vx: 0, vy: 0 }
  const last = samples[samples.length - 1]
  let first = samples[0]
  for (let i = samples.length - 1; i >= 0; i--) {
    if (last.t - samples[i].t > windowMs) break
    first = samples[i]
  }
  const dt = (last.t - first.t) / 1000
  if (dt <= 0) return { vx: 0, vy: 0 }
  return { vx: (last.x - first.x) / dt, vy: (last.y - first.y) / dt }
}

/** Proyección de inercia: el punto de reposo donde soltaría el objeto. */
export function project(velocity: number, decelerationRate = 0.998): number {
  return (velocity / 1000) * (decelerationRate / (1 - decelerationRate))
}