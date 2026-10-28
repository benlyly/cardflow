export const FLUID_POINTS = 64
export const IMPACT_DURATION = 1.5

export type Edge = 'left' | 'right'

const FIXED_STEP = 1 / 120
const TENSION = 70
const BASE_DAMPING = 2.4
const IMPACT_DAMPING = 0.7
const WAVE_SPEED_SQ = 8200

export class FluidSurface {
  readonly n: number
  readonly height: Float32Array
  readonly velocity: Float32Array
  private readonly laplacian: Float32Array
  private accumulator = 0
  private impactStrength = 0
  private impactAge = Number.POSITIVE_INFINITY
  private impactEdge: Edge = 'right'
  private seed = Math.random() * 1000

  constructor(n: number = FLUID_POINTS) {
    this.n = n
    this.height = new Float32Array(n)
    this.velocity = new Float32Array(n)
    this.laplacian = new Float32Array(n)
  }

  get impactProgress(): number {
    return Math.min(this.impactAge / IMPACT_DURATION, 1)
  }

  get impactEnergy(): number {
    if (this.impactAge >= IMPACT_DURATION) return 0
    const remaining = 1 - this.impactAge / IMPACT_DURATION
    return this.impactStrength * remaining * remaining
  }

  /** Gaussian velocity impulse centred on a (fractional) column index. */
  applyForce(index: number, force: number, radius = 3): void {
    const r2 = 2 * radius * radius
    const from = Math.max(0, Math.floor(index - radius * 3))
    const to = Math.min(this.n - 1, Math.ceil(index + radius * 3))
    for (let i = from; i <= to; i++) {
      const d = i - index
      this.velocity[i] += force * Math.exp(-(d * d) / r2)
    }
  }

  /** Linear impulse across the surface — used to slosh the liquid against acceleration. */
  applyTilt(force: number): void {
    const last = this.n - 1
    for (let i = 0; i < this.n; i++) {
      this.velocity[i] += (i / last - 0.5) * force
    }
  }

  triggerImpact(edge: Edge, strength: number): void {
    this.impactEdge = edge
    this.impactStrength = strength
    this.impactAge = 0
    const span = 14
    for (let k = 0; k < span; k++) {
      const i = edge === 'right' ? this.n - 1 - k : k
      const falloff = Math.exp(-k / 4.5)
      const chaos = 0.75 + Math.random() * 0.5
      this.velocity[i] -= strength * 1150 * falloff * chaos
    }
  }

  step(dt: number, maxAmplitude: number): void {
    this.accumulator += Math.min(dt, 1 / 20)
    while (this.accumulator >= FIXED_STEP) {
      this.integrate(FIXED_STEP, maxAmplitude)
      this.accumulator -= FIXED_STEP
    }
  }

  private integrate(h: number, maxAmplitude: number): void {
    const { n, height, velocity, laplacian } = this
    this.impactAge += h

    const impactActive = this.impactAge < IMPACT_DURATION
    const progress = this.impactProgress
    const damping = impactActive
      ? IMPACT_DAMPING + (BASE_DAMPING - IMPACT_DAMPING) * progress * progress
      : BASE_DAMPING

    if (impactActive) {
      const energy = this.impactEnergy
      const t = this.impactAge * 38 + this.seed
      for (let k = 0; k < 6; k++) {
        const i = this.impactEdge === 'right' ? n - 1 - k : k
        velocity[i] += Math.sin(t + k * 1.7) * energy * 340 * h * 60 * Math.exp(-k / 2)
      }
    }

    for (let i = 0; i < n; i++) {
      const left = height[i === 0 ? 0 : i - 1]
      const right = height[i === n - 1 ? n - 1 : i + 1]
      laplacian[i] = left + right - 2 * height[i]
    }

    for (let i = 0; i < n; i++) {
      velocity[i] += (WAVE_SPEED_SQ * laplacian[i] - TENSION * height[i] - damping * velocity[i]) * h
      height[i] += velocity[i] * h
      if (height[i] > maxAmplitude) {
        height[i] = maxAmplitude
        velocity[i] *= -0.3
      } else if (height[i] < -maxAmplitude) {
        height[i] = -maxAmplitude
        velocity[i] *= -0.3
      }
    }
  }
}
