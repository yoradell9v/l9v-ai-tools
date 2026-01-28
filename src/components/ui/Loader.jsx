export default function Loader({ className = "" }) {
  return (
    <div className={`flex items-center justify-center gap-1.5 ${className}`}>
      <div className="w-2 h-2 rounded-full bg-[var(--primary)] dark:bg-[var(--accent)] animate-bounce" style={{ animationDelay: '0ms' }}></div>
      <div className="w-2 h-2 rounded-full bg-[var(--primary)] dark:bg-[var(--accent)] animate-bounce" style={{ animationDelay: '150ms' }}></div>
      <div className="w-2 h-2 rounded-full bg-[var(--primary)] dark:bg-[var(--accent)] animate-bounce" style={{ animationDelay: '300ms' }}></div>
    </div>
  );
}
