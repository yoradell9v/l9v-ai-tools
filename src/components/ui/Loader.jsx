export default function Loader() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 border-4 border-[var(--accent)]/20 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-transparent border-t-[var(--accent)] rounded-full animate-spin"></div>
      </div>
    </div>
  );
}
