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
const BUBBLES = 6

const FRAME_STROKE = 'rgba(86,132,230,0.6)'
const FRAME_GLOW = 'rgba(120,170,255,0.9)'
const FRAME_CORE = 'rgba(214,230,255,0.95)'
const FRAME_DURATION = '7s'

interface LiquidPalette {
  stops: ReadonlyArray<readonly [number, string]>
  meniscus: string
  meniscusGlow: string
  light: string
}

const TEA: LiquidPalette = {
  stops: [
    [0, 'rgba(222,232,150,0.16)'],
    [0.35, 'rgba(182,206,96,0.26)'],
    [0.75, 'rgba(128,160,52,0.4)'],
    [1, 'rgba(82,112,30,0.55)'],
  ],
  meniscus: 'rgba(244,250,206,0.85)',
  meniscusGlow: 'rgba(196,230,120,0.7)',
  light: 'rgba(214,240,150,',
}

const COFFEE: LiquidPalette = {
  stops: [
    [0, 'rgba(244,196,136,0.16)'],
    [0.35, 'rgba(206,130,62,0.28)'],
    [0.75, 'rgba(150,78,28,0.44)'],
    [1, 'rgba(98,44,14,0.6)'],
  ],
  meniscus: 'rgba(255,228,196,0.85)',
  meniscusGlow: 'rgba(244,170,100,0.7)',
  light: 'rgba(255,196,130,',
}

interface HalfRuntime {
  canvas: HTMLCanvasElement | null
  el: HTMLDivElement | null
  surface: FluidSurface
  palette: LiquidPalette
  /** Which canvas edge sits on the centre seam (where the halves collide). */
  seam: Edge
  phase: number
  pull: Float32Array
  pullVelocity: Float32Array
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
  pointer: { x: number; y: number; vx: number; lastX: number; lastT: number; active: boolean }
  recoil: number
  shockAge: number
  shockStrength: number
  dpr: number
  size: number
  time: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function createHalf(palette: LiquidPalette, seam: Edge, phase: number): HalfRuntime {
  return {
    canvas: null,
    el: null,
    surface: new FluidSurface(FLUID_POINTS),
    palette,
    seam,
    phase,
    pull: new Float32Array(FLUID_POINTS),
    pullVelocity: new Float32Array(FLUID_POINTS),
    width: 0,
    height: 0,
  }
}

/** Surface bulges toward the pointer like liquid drawn by a magnet, with a springy overshoot. */
function updateMagnet(half: HalfRuntime, pointer: PhysicsState['pointer'], dt: number) {
  const { canvas, pull, pullVelocity, width: w, height: h } = half
  const n = pull.length
  const rect = canvas?.getBoundingClientRect()
  let localX = 0
  let reach = 0
  let proximity = 0

  if (rect && rect.width > 0 && pointer.active) {
    localX = ((pointer.x - rect.left) / rect.width) * w
    const localY = ((pointer.y - rect.top) / rect.height) * h
    const outsideX = Math.max(0, rect.left - pointer.x, pointer.x - rect.right)
    const outsideY = Math.max(0, rect.top - pointer.y, pointer.y - rect.bottom)
    const distance = Math.hypot(outsideX, outsideY)
    const range = Math.max(w, 60) * 0.9
    proximity = Math.exp(-(distance * distance) / (2 * range * range))
    reach = clamp(localY - h * SURFACE_LEVEL, -h * 0.4, h * 0.3) * 0.6
  }

  const sigma = w * 0.24
  const twoSigmaSq = 2 * sigma * sigma
  for (let i = 0; i < n; i++) {
    const xi = (i / (n - 1)) * w
    const dx = xi - localX
    const target = reach * proximity * Math.exp(-(dx * dx) / twoSigmaSq)
    const accel = (target - pull[i]) * 70 - pullVelocity[i] * 9
    pullVelocity[i] += accel * dt
    pull[i] += pullVelocity[i] * dt
  }
}

function drawHalf(half: HalfRuntime, dpr: number, time: number) {
  const { canvas, surface, palette, seam, phase, pull, width: w, height: h } = half
  const ctx = canvas?.getContext('2d')
  if (!ctx || w === 0) return

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)

  const glass = ctx.createLinearGradient(0, 0, 0, h)
  glass.addColorStop(0, 'rgba(255,255,255,0.035)')
  glass.addColorStop(1, 'rgba(255,255,255,0.01)')
  ctx.fillStyle = glass
  ctx.fillRect(0, 0, w, h)

  const baseY = h * SURFACE_LEVEL
  const n = surface.n
  const xs = new Float32Array(n)
  const ys = new Float32Array(n)
  const tilt = Math.sin(time * 0.85 + phase) * h * 0.04 + Math.sin(time * 1.55 + phase * 2.3) * h * 0.014
  const swell = Math.sin(time * 1.2 + phase) * h * 0.012
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1)
    const ambient = Math.sin(i * 0.21 + time * 1.4 + phase) * 0.6 + Math.sin(i * 0.08 - time * 0.8) * 0.9
    const slosh = (u - 0.5) * 2 * tilt + Math.sin(u * Math.PI) * swell
    xs[i] = u * w
    ys[i] = baseY + surface.height[i] + slosh + ambient + pull[i]
  }

  const traceSurface = (target: CanvasRenderingContext2D | Path2D, offsetY: number) => {
    target.moveTo(xs[0], ys[0] + offsetY)
    for (let i = 1; i < n - 1; i++) {
      target.quadraticCurveTo(xs[i], ys[i] + offsetY, (xs[i] + xs[i + 1]) / 2, (ys[i] + ys[i + 1]) / 2 + offsetY)
    }
    target.lineTo(xs[n - 1], ys[n - 1] + offsetY)
  }

  const liquid = new Path2D()
  traceSurface(liquid, 0)
  liquid.lineTo(w, h)
  liquid.lineTo(0, h)
  liquid.closePath()

  const body = ctx.createLinearGradient(0, baseY - h * 0.1, 0, h)
  for (const [offset, color] of palette.stops) body.addColorStop(offset, color)
  ctx.fillStyle = body
  ctx.fill(liquid)

  const energy = surface.impactEnergy
  const vertexX = seam === 'right' ? w : 0

  ctx.save()
  ctx.clip(liquid)
  ctx.globalCompositeOperation = 'lighter'

  const fresnel = ctx.createLinearGradient(0, baseY - h * 0.08, 0, baseY + h * 0.16)
  fresnel.addColorStop(0, 'rgba(255,255,255,0.1)')
  fresnel.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = fresnel
  ctx.fillRect(0, 0, w, h)

  const glow = ctx.createRadialGradient(vertexX, h * 0.7, 0, vertexX, h * 0.7, w * (0.9 + energy * 0.4))
  const glowAlpha = 0.12 + Math.sin(time * 1.4) * 0.02 + energy * 0.3
  glow.addColorStop(0, `${palette.light}${glowAlpha.toFixed(3)})`)
  glow.addColorStop(1, `${palette.light}0)`)
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, w, h)

  ctx.lineCap = 'round'
  for (let k = 0; k < 3; k++) {
    const y0 = baseY + h * (0.16 + k * 0.15)
    const speed = 0.7 + k * 0.35
    ctx.beginPath()
    for (let x = 0; x <= w; x += 4) {
      const y = y0 + Math.sin(x * 0.045 + time * speed + phase + k) * h * 0.022 + Math.sin(x * 0.11 - time * 1.3) * h * 0.008
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.lineWidth = 1.1 - k * 0.2
    ctx.strokeStyle = `${palette.light}${(0.16 - k * 0.04).toFixed(3)})`
    ctx.stroke()
  }

  for (let b = 0; b < BUBBLES; b++) {
    const period = 4.5 + b * 0.85
    const progress = ((time + b * 1.7 + phase) / period) % 1
    const anchor = seam === 'right' ? 0.55 + ((b * 0.37) % 0.42) : 0.03 + ((b * 0.37) % 0.42)
    const bx = anchor * w + Math.sin(time * 2.4 + b) * 1.6
    const index = clamp(Math.round((bx / w) * (n - 1)), 0, n - 1)
    const surfaceY = ys[index]
    const by = h - progress * (h - surfaceY)
    const radius = 0.55 + (b % 3) * 0.35
    ctx.beginPath()
    ctx.arc(bx, by, radius, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255,255,255,${(0.32 * Math.sin(progress * Math.PI)).toFixed(3)})`
    ctx.fill()
  }
  ctx.restore()

  ctx.save()
  ctx.beginPath()
  traceSurface(ctx, 0)
  ctx.lineWidth = 0.9
  ctx.strokeStyle = palette.meniscus
  ctx.shadowColor = palette.meniscusGlow
  ctx.shadowBlur = 6 + energy * 10
  ctx.stroke()
  ctx.restore()

  ctx.save()
  ctx.beginPath()
  traceSurface(ctx, 2.2)
  const reflection = ctx.createLinearGradient(0, 0, w, 0)
  const near = seam === 'right' ? 1 : 0
  reflection.addColorStop(near, 'rgba(255,255,255,0.35)')
  reflection.addColorStop(0.5, 'rgba(255,255,255,0.12)')
  reflection.addColorStop(1 - near, 'rgba(255,255,255,0)')
  ctx.lineWidth = 0.6
  ctx.strokeStyle = reflection
  ctx.stroke()
  ctx.restore()
}

/** One half of the running blue frame; each half carries the light for half of the loop. */
function FrameHalf({ points, offsetFrom }: { points: string; offsetFrom: number }) {
  return (
    <>
      <polyline points={points} fill="none" stroke={FRAME_STROKE} strokeWidth={0.7} strokeLinejoin="round" />
      <polyline
        points={points}
        pathLength={50}
        fill="none"
        stroke={FRAME_GLOW}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="8 92"
        filter="url(#frame-glow)"
      >
        <animate
          attributeName="stroke-dashoffset"
          from={offsetFrom}
          to={offsetFrom - 100}
          dur={FRAME_DURATION}
          repeatCount="indefinite"
        />
      </polyline>
      <polyline
        points={points}
        pathLength={50}
        fill="none"
        stroke={FRAME_CORE}
        strokeWidth={0.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="3 97"
      >
        <animate
          attributeName="stroke-dashoffset"
          from={offsetFrom - 2.5}
          to={offsetFrom - 102.5}
          dur={FRAME_DURATION}
          repeatCount="indefinite"
        />
      </polyline>
    </>
  )
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
    halves.current = { tea: createHalf(TEA, 'right', 0), coffee: createHalf(COFFEE, 'left', 2.1) }
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
    pointer: { x: 0, y: 0, vx: 0, lastX: 0, lastT: 0, active: false },
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
    const pointer = physics.current.pointer
    const track = (event: PointerEvent) => {
      pointer.x = event.clientX
      pointer.y = event.clientY
      pointer.active = true
    }
    const leave = () => {
      pointer.active = false
    }
    const touchEnd = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') pointer.active = false
    }
    window.addEventListener('pointermove', track, { passive: true })
    window.addEventListener('pointerdown', track, { passive: true })
    window.addEventListener('pointerup', touchEnd, { passive: true })
    window.addEventListener('pointercancel', leave, { passive: true })
    document.documentElement.addEventListener('pointerleave', leave)
    window.addEventListener('blur', leave)
    return () => {
      window.removeEventListener('pointermove', track)
      window.removeEventListener('pointerdown', track)
      window.removeEventListener('pointerup', touchEnd)
      window.removeEventListener('pointercancel', leave)
      document.documentElement.removeEventListener('pointerleave', leave)
      window.removeEventListener('blur', leave)
    }
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
        updateMagnet(half, s.pointer, dt)
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
      const force = clamp(vx * 140 * depth, -420, 420)
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
    <div className="relative flex aspect-[1.7/1] w-[clamp(220px,60vw,260px)] items-center justify-center sm:w-[clamp(260px,32vw,400px)]">
      <div
        ref={stageRef}
        role="img"
        tabIndex={0}
        aria-label="Split diamond: tea on the left, coffee on the right. Move the cursor near the liquid to draw it like a magnet, drag sideways or press the arrow keys to part the halves and release to make them clash."
        className="relative aspect-[1.7/1] w-[62%] cursor-grab touch-none select-none outline-none will-change-transform active:cursor-grabbing focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:ring-offset-8 focus-visible:ring-offset-[#070708]"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={release}
        onPointerCancel={release}
        onKeyDown={handleKeyDown}
      >
        <svg aria-hidden="true" width="0" height="0" className="absolute">
          <defs>
            <filter id="frame-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="2" />
            </filter>
          </defs>
        </svg>

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
            viewBox="0 0 85 100"
            aria-hidden="true"
          >
            <polygon points="85,0 85,100 0,50" fill="none" stroke="rgba(230,240,200,0.32)" strokeWidth={0.6} />
            <FrameHalf points="85,-4 -6.5,50 85,104" offsetFrom={0} />
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
            viewBox="0 0 85 100"
            aria-hidden="true"
          >
            <polygon points="0,0 85,50 0,100" fill="none" stroke="rgba(250,224,200,0.32)" strokeWidth={0.6} />
            <FrameHalf points="0,104 91.5,50 0,-4" offsetFrom={50} />
          </svg>
        </div>

        <div
          ref={seamRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2"
          style={{
            background: 'linear-gradient(to bottom, transparent, rgba(255,246,224,0.75) 50%, transparent)',
            boxShadow: '0 0 10px rgba(255,236,200,0.45)',
          }}
        />
      </div>
    </div>
  )
}
