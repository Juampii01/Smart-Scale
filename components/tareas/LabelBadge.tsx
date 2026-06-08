"use client"

interface LabelBadgeProps {
  label: { text: string; color: string }
  small?: boolean
}

export function LabelBadge({ label, small = false }: LabelBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${
        small ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1"
      }`}
      style={{
        backgroundColor: label.color + "22",
        color:           label.color,
        border:          `1px solid ${label.color}44`,
      }}
    >
      {label.text}
    </span>
  )
}
