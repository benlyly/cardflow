const GOLD_GRADIENT =
  'linear-gradient(180deg, #f7e7b4 0%, #d9b36a 38%, #a87a32 62%, #e8cf8f 82%, #8a6326 100%)'

function Ornament({ flip = false }: { flip?: boolean }) {
  return (
    <span className={`flex items-center gap-2 ${flip ? 'flex-row-reverse' : ''}`} aria-hidden="true">
      <span
        className="h-px w-10 md:w-24"
        style={{
          background: `linear-gradient(${flip ? '270deg' : '90deg'}, transparent, rgba(217,179,106,0.7))`,
        }}
      />
      <span className="size-1.5 rotate-45 border border-[rgba(217,179,106,0.8)]" />
    </span>
  )
}

export function MasterTitle() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-4 md:gap-7">
        <Ornament />
        <h1
          className="bg-clip-text pl-[0.32em] font-[family-name:var(--font-display)] text-5xl font-light uppercase leading-none tracking-[0.32em] text-transparent md:text-7xl"
          style={{
            backgroundImage: GOLD_GRADIENT,
            WebkitTextStroke: '0.6px rgba(247,231,180,0.35)',
            filter: 'drop-shadow(0 0 18px rgba(217,179,106,0.18))',
          }}
        >
          Master
        </h1>
        <Ornament flip />
      </div>
      <span
        className="h-px w-48 md:w-80"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(217,179,106,0.45), transparent)' }}
        aria-hidden="true"
      />
    </div>
  )
}
