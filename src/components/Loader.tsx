export function Loader() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="block h-10 w-10 animate-spin rounded-full border border-gold/30 border-t-gold" aria-hidden="true" />
      <img src="/logo.jpg" alt="SULTAN BLACK" className="h-14 w-auto object-contain animate-pulse" />
    </div>
  )
}