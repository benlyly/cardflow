'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'
import { FLUID_POINTS, FluidSurface, IMPACT_DURATION, type Edge } from '@/lib/fluid-surface'

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

const TEA_CLIP = 'polygon(100% 0, 100% 100%, 0 50%)'
const COFFEE_CLIP = 'polygon(0 0, 100% 50%, 0 100%)'
const SPRING_STEP = 1 / 240
const LEAD_FACTOR = 1.34
const TRAIL_FACTOR = 0.48
const SURFACE_LEVEL = 0.42

interface LiquidPalette {
  stops: ReadonlyArray<readonly [number, string]>
  meniscus: string
  meniscusGlow: string
  caustic: string
}

const TEA: LiquidPalette = {
  stops: [
    [0, 'rgba(206,196,112,0.35)'],
    [0.32, 'rgba(156,156,64,0.6)'],
    [0.68, 'rgba(92,106,32,0.84)'],
    [1, 'rgba(36,46,14,0.96)'],
  ],
  meniscus: 'rgba(236,232,170,0.9)',
  meniscusGlow: 'rgba(180,214,110,0.85)',
  caustic: 'rgba(176,210,96,',
}

const COFFEE: LiquidPalette = {
  stops: [
    [0, 'rgba(220,160,96,0.35)'],
    [0.32, 'rgba(166,98,46,0.62)'],
    [0.68, 'rgba(96,48,20,0.86)'],
    [1, 'rgba(32,14,6,0.96)'],
  ],
  meniscus: 'rgba(248,212,170,0.9)',
  meniscusGlow: 'rgba(236,152,80,0.85)',
  caustic: 'rgba(236,148,64,',
}

interface HalfRuntime {
  canvas: HTMLCanvasElement | null
  el: HTMLDivElement | null
  surface: FluidSurface
  palette: LiquidPalette
  /** Which canvas edge sits on the centre seam (where the halves collide). */
  seam: Edge
  width: number
  height: number
}

interface PhysicsState {
  targetX: number
  x: number
  v: number
  prevV: number
  dragging: boolean
  armed: boolean
  pointerId: number | null
  dragOriginX: number
  pointer: { x: number; y: number; vx: number; lastX: number; lastT: number }
  recoil: number
  shockAge: number
  shockStrength: number
  dpr: number
  size: number
  time: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function drawHalf(half: HalfRuntime, dpr: number, time: number) {
  const { canvas, surface, palette, seam, width: w, height: h } = half
  const ctx = canvas?.getContext('2d')
  if (!ctx || w === 0) return

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)

  const glass = ctx.createLinearGradient(0, 0, 0, h)
  glass.addColorStop(0, 'rgba(255,255,255,0.028)')
  glass.addColorStop(1, 'rgba(255,255,255,0.006)')
  ctx.fillStyle = glass
  ctx.fillRect(0, 0, w, h)

  const baseY = h * SURFACE_LEVEL
  const n = surface.n
  const xs = new Float32Array(n)
  const ys = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const ambient = Math.sin(i * 0.19 + time * 1.25) * 0.55 + Math.sin(i * 0.071 - time * 0.7) * 0.9
    xs[i] = (i / (n - 1)) * w
    ys[i] = baseY + surface.height[i] + ambient
  }

  const traceSurface = (offsetY: number) => {
    ctx.moveTo(xs[0], ys[0] + offsetY)
    for (let i = 1; i < n - 1; i++) {
      const mx = (xs[i] + xs[i + 1]) / 2
      const my = (ys[i] + ys[i + 1]) / 2 + offsetY
      ctx.quadraticCurveTo(xs[i], ys[i] + offsetY, mx, my)
    }
    ctx.lineTo(xs[n - 1], ys[n - 1] + offsetY)
  }

  const liquid = new Path2D()
  liquid.moveTo(xs[0], ys[0])
  for (let i = 1; i < n - 1; i++) {
    liquid.quadraticCurveTo(xs[i], ys[i], (xs[i] + xs[i + 1]) / 2, (ys[i] + ys[i + 1]) / 2)
  }
  liquid.lineTo(xs[n - 1], ys[n - 1])
  liquid.lineTo(w, h)
  liquid.lineTo(0, h)
  liquid.closePath()

  const body = ctx.createLinearGradient(0, baseY - h * 0.06, 0, h)
  for (const [offset, color] of palette.stops) body.addColorStop(offset, color)
  ctx.fillStyle = body
  ctx.fill(liquid)

  const energy = surface.impactEnergy
  const vertexX = seam === 'right' ? w : 0
  ctx.save()
  ctx.clip(liquid)
  ctx.globalCompositeOperation = 'lighter'
  const causticRadius = w * (1.05 + energy * 0.35)
  const caustic = ctx.createRadialGradient(vertexX, h, 0, vertexX, h, causticRadius)
  const causticAlpha = 0.26 + Math.sin(time * 1.6) * 0.04 + energy * 0.35
  caustic.addColorStop(0, `${palette.caustic}${causticAlpha.toFixed(3)})`)
  caustic.addColorStop(0.45, `${palette.caustic}${(causticAlpha * 0.32).toFixed(3)})`)
  caustic.addColorStop(1, `${palette.caustic}0)`)
  ctx.fillStyle = caustic
  ctx.fillRect(0, 0, w, h)
  ctx.restore()

  ctx.save()
  ctx.beginPath()
  traceSurface(0)
  ctx.lineWidth = 1.0
  ctx.strokeStyle = palette.meniscus
  ctx.shadowColor = palette.meniscusGlow
  ctx.shadowBlur = 8 + energy * 10
  ctx.stroke()
  ctx.restore()

  ctx.save()
  ctx.beginPath()
  traceSurface(2)
  const reflection = ctx.createLinearGradient(0, 0, w, 0)
  const near = seam === 'right' ? 1 : 0
  reflection.addColorStop(near, 'rgba(255,255,255,0.32)')
  reflection.addColorStop(0.5, 'rgba(255,255,255,0.12)')
  reflection.addColorStop(1 - near, 'rgba(255,255,255,0)')
  ctx.lineWidth = 0.6
  ctx.strokeStyle = reflection
  ctx.stroke()
  ctx.restore()
}

export function SplitDiamond() {
  const stageRef = useRef<HTMLDivElement>(null)
  const seamRef = useRef<HTMLDivElement>(null)
  const shockRef = useRef<SVGSVGElement>(null)
  const teaCanvasRef = useRef<HTMLCanvasElement>(null)
  const coffeeCanvasRef = useRef<HTMLCanvasElement>(null)
  const teaRef = useRef<HTMLDivElement>(null)
  const coffeeRef = useRef<HTMLDivElement>(null)

  const halves = useRef<{ tea: HalfRuntime; coffee: HalfRuntime } | null>(null)
  if (halves.current === null) {
    halves.current = {
      tea: { canvas: null, el: null, surface: new FluidSurface(FLUID_POINTS), palette: TEA, seam: 'right', width: 0, height: 0 },
      coffee: { canvas: null, el: null, surface: new FluidSurface(FLUID_POINTS), palette: COFFEE, seam: 'left', width: 0, height: 0 },
    }
  }

  const physics = useRef<PhysicsState>({
    targetX: 0,
    x: 0,
    v: 0,
    prevV: 0,
    dragging: false,
    armed: false,
    pointerId: null,
    dragOriginX: 0,
    pointer: { x: 0, y: 0, vx: 0, lastX: 0, lastT: 0 },
    recoil: 0,
    shockAge: Number.POSITIVE_INFINITY,
    shockStrength: 0,
    dpr: 1,
    size: 0,
    time: 0,
  })

  useIsomorphicLayoutEffect(() => {
    const stage = stageRef.current
    const runtime = halves.current
    if (!stage || !runtime) return
    runtime.tea.canvas = teaCanvasRef.current
    runtime.coffee.canvas = coffeeCanvasRef.current
    runtime.tea.el = teaRef.current
    runtime.coffee.el = coffeeRef.current

    const resize = () => {
      const size = stage.clientWidth
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      physics.current.size = size
      physics.current.dpr = dpr
      for (const half of [runtime.tea, runtime.coffee]) {
        if (!half.canvas) continue
        half.width = size / 2
        half.height = stage.clientHeight
        half.canvas.width = Math.round(half.width * dpr)
        half.canvas.height = Math.round(half.height * dpr)
      }
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const runtime = halves.current
    if (!runtime) return
    let frame = 0
    let last = performance.now()
    let springAccumulator = 0

    const triggerImpact = (velocity: number) => {
      const s = physics.current
      const strength = clamp(Math.abs(velocity) / 1500, 0.25, 1.6)
      runtime.tea.surface.triggerImpact('right', strength)
      runtime.coffee.surface.triggerImpact('left', strength)
      s.recoil = strength
      s.shockAge = 0
      s.shockStrength = strength
    }

    const tick = (now: number) => {
      const s = physics.current
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      s.time += dt

      const stiffness = s.dragging ? 320 : 620
      const damping = s.dragging ? 28 : 16
      springAccumulator += dt
      while (springAccumulator >= SPRING_STEP) {
        const prevX = s.x
        const accel = -stiffness * (s.x - s.targetX) - damping * s.v
        s.v += accel * SPRING_STEP
        s.x += s.v * SPRING_STEP

        if (!s.dragging && !s.armed && Math.abs(s.x) > 6) s.armed = true
        if (!s.dragging && s.armed && ((prevX < 0 && s.x >= 0) || (prevX > 0 && s.x <= 0))) {
          const impactVelocity = s.v
          s.x = 0
          s.v = 0
          s.armed = false
          triggerImpact(impactVelocity)
        }
        springAccumulator -= SPRING_STEP
      }

      const acceleration = (s.v - s.prevV) / Math.max(dt, 1e-3)
      s.prevV = s.v

      const x = s.x
      const teaFactor = x < 0 ? LEAD_FACTOR : TRAIL_FACTOR
      const coffeeFactor = x > 0 ? LEAD_FACTOR : TRAIL_FACTOR
      const teaRotation = clamp(s.v * 0.0011 * teaFactor * 10, -14, 14)
      const coffeeRotation = clamp(-s.v * 0.0011 * coffeeFactor * 10, -14, 14)
      const lift = Math.abs(x) * 0.04

      if (runtime.tea.el) {
        runtime.tea.el.style.transform = `translate3d(${(x * teaFactor).toFixed(2)}px, ${(-lift * teaFactor).toFixed(2)}px, 0) rotate(${teaRotation.toFixed(2)}deg)`
      }
      if (runtime.coffee.el) {
        runtime.coffee.el.style.transform = `translate3d(${(x * coffeeFactor).toFixed(2)}px, ${(lift * coffeeFactor).toFixed(2)}px, 0) rotate(${coffeeRotation.toFixed(2)}deg)`
      }

      s.recoil *= Math.exp(-dt * 7)
      s.shockAge += dt
      const shockProgress = Math.min(s.shockAge / IMPACT_DURATION, 1)
      if (stageRef.current) {
        const jitter = s.recoil * Math.sin(s.time * 90) * 1.4
        stageRef.current.style.transform = `translateX(${jitter.toFixed(2)}px) scale(${(1 + s.recoil * 0.035).toFixed(4)})`
      }
      if (seamRef.current) {
        const separation = Math.min(Math.abs(x) / 40, 1)
        const flash = (1 - shockProgress) ** 3 * s.shockStrength
        seamRef.current.style.opacity = Math.max(0, 0.55 - separation * 0.55 + flash).toFixed(3)
      }
      if (shockRef.current) {
        const eased = 1 - (1 - shockProgress) ** 3
        shockRef.current.style.transform = `scale(${(0.2 + eased * (1.4 + s.shockStrength)).toFixed(3)})`
        shockRef.current.style.opacity = ((1 - shockProgress) ** 2 * Math.min(s.shockStrength, 1) * 0.7).toFixed(3)
      }

      const maxAmplitude = (stageRef.current?.clientHeight ?? s.size) * 0.22
      for (const [half, factor] of [
        [runtime.tea, teaFactor],
        [runtime.coffee, coffeeFactor],
      ] as const) {
        half.surface.applyTilt(clamp(acceleration * factor * 0.0042, -90, 90) * dt * 60)
        half.surface.step(dt, maxAmplitude)
        drawHalf(half, s.dpr, s.time)
      }

      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  const rubberBand = (dx: number) => {
    const limit = physics.current.size * 1.05 || 240
    return Math.sign(dx) * limit * (1 - Math.exp(-Math.abs(dx) / limit))
  }

  const rippleAt = (clientX: number, clientY: number, vx: number) => {
    const runtime = halves.current
    if (!runtime) return
    for (const half of [runtime.tea, runtime.coffee]) {
      const rect = half.canvas?.getBoundingClientRect()
      if (!rect || rect.width === 0) continue
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) continue
      const index = ((clientX - rect.left) / rect.width) * (FLUID_POINTS - 1)
      const depth = clamp((clientY - rect.top) / rect.height - SURFACE_LEVEL + 0.35, 0.2, 1)
      const force = clamp(vx * 170 * depth, -520, 520)
      const direction = Math.sign(vx)
      half.surface.applyForce(index + direction * 2.5, Math.abs(force), 2.6)
      half.surface.applyForce(index - direction * 2.5, -Math.abs(force) * 0.85, 2.6)
    }
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const s = physics.current
    event.currentTarget.setPointerCapture(event.pointerId)
    s.pointerId = event.pointerId
    s.dragging = true
    s.armed = false
    s.dragOriginX = event.clientX - s.targetX
    s.pointer.lastX = event.clientX
    s.pointer.lastT = event.timeStamp
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const s = physics.current
    const elapsed = Math.max(event.timeStamp - s.pointer.lastT, 1)
    const instantVx = (event.clientX - s.pointer.lastX) / elapsed
    s.pointer.vx = s.pointer.vx * 0.6 + instantVx * 0.4
    s.pointer.lastX = event.clientX
    s.pointer.lastT = event.timeStamp
    s.pointer.x = event.clientX
    s.pointer.y = event.clientY

    if (s.dragging && event.pointerId === s.pointerId) {
      s.targetX = rubberBand(event.clientX - s.dragOriginX)
    }
    rippleAt(event.clientX, event.clientY, s.pointer.vx)
  }

  const release = (event: React.PointerEvent<HTMLDivElement>) => {
    const s = physics.current
    if (event.pointerId !== s.pointerId) return
    s.dragging = false
    s.pointerId = null
    s.targetX = 0
    s.dragOriginX = 0
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const s = physics.current
    if (s.dragging) return
    s.v += event.key === 'ArrowLeft' ? -1900 : 1900
  }

  return (
    <div className="relative flex aspect-[1.7/1] w-[clamp(240px,34vw,400px)] items-center justify-center">
      <div
        ref={stageRef}
        role="img"
        tabIndex={0}
        aria-label="Split diamond: tea on the left, coffee on the right. Drag sideways or press the arrow keys to part the halves and release to make them clash."
        className="relative aspect-[1.7/1] w-1/2 cursor-grab touch-none select-none outline-none will-change-transform active:cursor-grabbing focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:ring-offset-8 focus-visible:ring-offset-[#070708]"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={release}
        onPointerCancel={release}
        onKeyDown={handleKeyDown}
      >
        <svg
          ref={shockRef}
          aria-hidden="true"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 size-full overflow-visible opacity-0"
          style={{ transform: 'scale(0.2)', filter: 'blur(0.5px)' }}
        >
          <polygon
            points="50,0 100,50 50,100 0,50"
            fill="none"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <div
          ref={teaRef}
          className="absolute inset-y-0 left-0 w-1/2 will-change-transform"
          style={{ transformOrigin: '100% 50%' }}
        >
          <div className="absolute inset-0" style={{ clipPath: TEA_CLIP }}>
            <canvas ref={teaCanvasRef} className="block size-full" aria-hidden="true" />
          </div>
          <svg
            className="pointer-events-none absolute inset-0 size-full overflow-visible"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <polygon
              points="100,0 100,100 0,50"
              fill="none"
              stroke="rgba(230,236,200,0.38)"
              strokeWidth={0.5}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>

        <div
          ref={coffeeRef}
          className="absolute inset-y-0 right-0 w-1/2 will-change-transform"
          style={{ transformOrigin: '0% 50%' }}
        >
          <div className="absolute inset-0" style={{ clipPath: COFFEE_CLIP }}>
            <canvas ref={coffeeCanvasRef} className="block size-full" aria-hidden="true" />
          </div>
          <svg
            className="pointer-events-none absolute inset-0 size-full overflow-visible"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <polygon
              points="0,0 100,50 0,100"
              fill="none"
              stroke="rgba(244,220,196,0.38)"
              strokeWidth={0.5}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>

        <svg
          aria-hidden="true"
          viewBox="0 0 170 100"
          className="pointer-events-none absolute inset-0 size-full overflow-visible"
        >
          <defs>
            <filter id="frame-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.2" />
            </filter>
          </defs>
          <polygon
            points="85,-7 182,50 85,107 -12,50"
            fill="none"
            stroke="rgba(86,132,230,0.55)"
            strokeWidth={0.7}
          />
          <polygon
            points="85,-7 182,50 85,107 -12,50"
            pathLength={100}
            fill="none"
            stroke="rgba(120,170,255,0.9)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray="10 90"
            filter="url(#frame-glow)"
          >
            <animate attributeName="stroke-dashoffset" from="0" to="-100" dur="7s" repeatCount="indefinite" />
          </polygon>
          <polygon
            points="85,-7 182,50 85,107 -12,50"
            pathLength={100}
            fill="none"
            stroke="rgba(206,224,255,0.95)"
            strokeWidth={0.9}
            strokeLinecap="round"
            strokeDasharray="4 96"
          >
            <animate attributeName="stroke-dashoffset" from="-3" to="-103" dur="7s" repeatCount="indefinite" />
          </polygon>
        </svg>

        <div
          ref={seamRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2"
          style={{
            background:
              'linear-gradient(to bottom, transparent, rgba(255,246,224,0.75) 50%, transparent)',
            boxShadow: '0 0 10px rgba(255,236,200,0.45)',
          }}
        />
      </div>
    </div>
  )
}
