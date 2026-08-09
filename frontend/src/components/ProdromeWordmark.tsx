export default function ProdromeWordmark({ small }: { small?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: small ? "8px" : "10px" }}>
      {/* Logomark: abstracted committee/node icon */}
      <svg
        width={small ? "22" : "28"}
        height={small ? "22" : "28"}
        viewBox="0 0 28 28"
        fill="none"
      >
        {/* Outer ring */}
        <circle cx="14" cy="14" r="12" stroke="#06b6d4" strokeWidth="1.5" opacity="0.3" />
        {/* Four agent nodes */}
        <circle cx="14" cy="4" r="2.5" fill="#10b981" />
        <circle cx="24" cy="14" r="2.5" fill="#f59e0b" />
        <circle cx="14" cy="24" r="2.5" fill="#f97316" />
        <circle cx="4" cy="14" r="2.5" fill="#ef4444" />
        {/* Center node (judge) */}
        <circle cx="14" cy="14" r="3.5" fill="#06b6d4" />
        {/* Connection lines */}
        <line x1="14" y1="6.5" x2="14" y2="10.5" stroke="#06b6d4" strokeWidth="1" opacity="0.4" />
        <line x1="21.5" y1="14" x2="17.5" y2="14" stroke="#06b6d4" strokeWidth="1" opacity="0.4" />
        <line x1="14" y1="21.5" x2="14" y2="17.5" stroke="#06b6d4" strokeWidth="1" opacity="0.4" />
        <line x1="6.5" y1="14" x2="10.5" y2="14" stroke="#06b6d4" strokeWidth="1" opacity="0.4" />
      </svg>
      <span style={{
        fontFamily: "var(--font-ui)",
        fontSize: small ? "14px" : "18px",
        fontWeight: 700,
        letterSpacing: "-0.02em",
        color: "#e8edf2",
      }}>
        Prodrome
      </span>
    </div>
  )
}

