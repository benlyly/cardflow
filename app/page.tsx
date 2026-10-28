import { Backdrop } from '@/components/master-club/backdrop'
import { SplitDiamond } from '@/components/master-club/split-diamond'

export default function Page() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#070708] text-white/70">
      <Backdrop />

      <header className="relative z-10 flex items-center justify-between px-6 py-6 md:px-10 md:py-8">
        <span className="text-[13px] font-light tracking-[0.32em] text-white/80">master.club</span>
        <span className="text-[10px] font-light uppercase tracking-[0.4em] text-white/30">Head to Head</span>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center gap-14 px-6">
        <h1 className="sr-only">master.club — tea versus coffee</h1>

        <div className="flex items-center gap-6 md:gap-14">
          <div className="hidden flex-col items-end gap-1.5 text-right sm:flex">
            <span className="text-[10px] font-light uppercase tracking-[0.4em] text-[rgba(190,210,140,0.55)]">Tea</span>
            <span className="text-[11px] font-light tracking-wide text-white/25">Leaf, patience, light</span>
          </div>

          <SplitDiamond />

          <div className="hidden flex-col items-start gap-1.5 sm:flex">
            <span className="text-[10px] font-light uppercase tracking-[0.4em] text-[rgba(226,170,120,0.55)]">Coffee</span>
            <span className="text-[11px] font-light tracking-wide text-white/25">Fire, ritual, depth</span>
          </div>
        </div>

        <div className="flex items-center gap-8 sm:hidden">
          <span className="text-[10px] font-light uppercase tracking-[0.4em] text-[rgba(190,210,140,0.55)]">Tea</span>
          <span className="h-px w-6 bg-white/10" aria-hidden="true" />
          <span className="text-[10px] font-light uppercase tracking-[0.4em] text-[rgba(226,170,120,0.55)]">Coffee</span>
        </div>

        <p className="text-[10px] font-light uppercase tracking-[0.36em] text-white/25">
          Drag to part &middot; release to clash
        </p>
      </main>

      <footer className="relative z-10 flex flex-col items-center gap-2 px-6 pb-8 pt-6 text-center md:pb-10">
        <p className="text-sm font-extralight italic tracking-[0.08em] text-white/40 text-balance">
          {'...find the one whose love you drink...'}
        </p>
        <p className="text-[10px] font-light uppercase tracking-[0.36em] text-white/15">Est. by taste</p>
      </footer>
    </div>
  )
}
