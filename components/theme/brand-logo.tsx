"use client"

/**
 * Isotipo del manual de marca Smart Scale: un punto lima (el cliente) rodeado
 * de un anillo de 6 puntos (el Ecosistema Circular™). El anillo gira 44s
 * lineal infinito y el núcleo pulsa cada 3.6s — respeta prefers-reduced-motion
 * vía la clase `motion-reduce:animate-none`.
 */
function OrbitMark({ size = 28 }: { size?: number }) {
  const dots = [0, 60, 120, 180, 240, 300]
  return (
    <span
      className="relative inline-grid flex-none place-items-center"
      style={{ width: size, height: size }}
    >
      <span className="absolute inset-0 animate-[ss-spin_44s_linear_infinite] motion-reduce:animate-none">
        {dots.map(a => (
          <i
            key={a}
            className="absolute left-1/2 top-1/2 -m-[2px] h-1 w-1 rounded-full border-[1.3px] border-[#dafc69] opacity-50"
            style={{ transform: `rotate(${a}deg) translateY(-${size * 0.39}px) rotate(-${a}deg)` }}
          />
        ))}
      </span>
      <span
        className="rounded-full bg-[#dafc69] animate-[ss-pulse_3.6s_ease-out_infinite] motion-reduce:animate-none"
        style={{ width: "44%", aspectRatio: "1" }}
      />
    </span>
  )
}

export function BrandLogo({ size = 28, wordmarkSize = 15 }: { size?: number; wordmarkSize?: number }) {
  return (
    <span className="flex items-center gap-3">
      <OrbitMark size={size} />
      <span
        className="font-sans font-light uppercase leading-none tracking-[0.14em] text-foreground"
        style={{ fontSize: wordmarkSize }}
      >
        Smart<b className="font-extrabold tracking-[0.08em]">Scale</b>
      </span>
    </span>
  )
}
