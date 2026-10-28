import { Backdrop } from '@/components/master-club/backdrop'
import { MasterTitle } from '@/components/master-club/master-title'
import { SplitDiamond } from '@/components/master-club/split-diamond'

export default function Page() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#070708] text-white/70">
      <Backdrop />

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center gap-10 px-5 py-10 sm:gap-12 sm:px-6">
        <MasterTitle />

        <div className="flex items-center gap-10 md:gap-24">
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

        <p className="font-[family-name:var(--font-display)] text-center text-base font-light tracking-[0.06em] text-[rgba(232,207,143,0.6)] text-balance sm:text-lg sm:tracking-[0.08em]">
          {'...find the one whose love you drink...'}
        </p>
      </main>

      <footer className="relative z-10 flex justify-center px-6 pb-8 text-center md:pb-10">
        <p className="text-[10px] font-light tracking-[0.36em] text-[rgba(217,179,106,0.35)]">est. 2027</p>
      </footer>
    </div>
  )
}
