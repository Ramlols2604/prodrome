import { dissentColor } from "../lib/colors"

export default function DissentGauge({ score }: { score: number }) {
  const color = dissentColor(score)
  const radius = 34
  const circumference = 2 * Math.PI * radius
  const arc = circumference * 0.75 // 270deg arc
  const offset = arc - (arc * score) / 100
  const startAngle = 135
  const endAngle = startAngle + 270 * (score / 100)

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
      <div style={{ position: "relative", width: "88px", height: "88px" }}>
        <svg width="88" height="88" viewBox="0 0 88 88">
          {/* Track */}
          <circle
            cx="44"
            cy="44"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth="6"
            strokeDasharray={`${arc} ${circumference - arc}`}
            strokeDashoffset={-circumference * 0.125}
            strokeLinecap="round"
            transform="rotate(-90 44 44)"
            style={{ transformOrigin: "44px 44px" }}
          />
          {/* Filled arc */}
          <circle
            cx="44"
            cy="44"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeDasharray={`${arc - offset} ${circumference - (arc - offset)}`}
            strokeDashoffset={-circumference * 0.125}
            strokeLinecap="round"
            transform="rotate(-90 44 44)"
            style={{
              transformOrigin: "44px 44px",
              filter: `drop-shadow(0 0 6px ${color}88)`,
              transition: "stroke-dasharray 0.6s ease",
            }}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            paddingBottom: "8px",
          }}
        >
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "20px", fontWeight: 600, color, lineHeight: 1 }}>
            {score}
          </span>
        </div>
      </div>
      <span style={{ fontFamily: "var(--font-ui)", fontSize: "10px", fontWeight: 500, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
        Dissent
      </span>
    </div>
  )
}

