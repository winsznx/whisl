// Flat ball-and-net mark + Whisl lockup (imagery direction: flat/brutalist, no photoreal renders).
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
        <circle cx="13" cy="13" r="12" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M13 4l7 5-2.7 8h-8.6L6 9z M13 4v5 M20 9l-4.3 3.1 M6 9l4.3 3.1 M8.7 17l1.6-4.9h5.4l1.6 4.9"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
      <span className="font-display text-3xl" style={{ textTransform: "none", letterSpacing: "-0.02em" }}>
        Whisl
      </span>
    </span>
  );
}
