const GRAIN_SVG =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")"

export function Backdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
      <div
        className="mc-breathe absolute left-1/2 top-1/2 size-[min(70vw,720px)] -translate-x-[95%] -translate-y-1/2 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(90,130,40,0.06) 0%, rgba(90,130,40,0.03) 40%, transparent 70%)',
          filter: 'blur(90px)',
        }}
      />
      <div
        className="mc-breathe mc-breathe-delayed absolute left-1/2 top-1/2 size-[min(70vw,720px)] -translate-x-[5%] -translate-y-1/2 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(140,80,30,0.06) 0%, rgba(140,80,30,0.03) 40%, transparent 70%)',
          filter: 'blur(90px)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.55) 80%, rgba(0,0,0,0.85) 100%)' }}
      />
      <div
        className="absolute inset-0 mix-blend-overlay"
        style={{ backgroundImage: GRAIN_SVG, backgroundSize: '220px 220px', opacity: 0.025 }}
      />
    </div>
  )
}
