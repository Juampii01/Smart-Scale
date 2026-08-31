"use client"

/**
 * Isotipo del manual de marca Smart Scale: un punto lima (el cliente) rodeado
 * de un anillo de 6 puntos (el Ecosistema Circular™). El anillo gira 44s
 * lineal infinito y el núcleo pulsa cada 3.6s — respeta prefers-reduced-motion
 * vía la clase `motion-reduce:animate-none`.
 */
function OrbitMark({ size = 28, mono = false }: { size?: number; mono?: boolean }) {
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
            className={mono
              ? "absolute left-1/2 top-1/2 -m-[2px] h-1 w-1 rounded-full border-[1.3px] border-foreground opacity-40"
              : "absolute left-1/2 top-1/2 -m-[2px] h-1 w-1 rounded-full border-[1.3px] border-accent opacity-50"}
            style={{ transform: `rotate(${a}deg) translateY(-${size * 0.39}px) rotate(-${a}deg)` }}
          />
        ))}
      </span>
      <span
        className={mono
          ? "rounded-full bg-foreground animate-[ss-pulse_3.6s_ease-out_infinite] motion-reduce:animate-none"
          : "rounded-full bg-accent animate-[ss-pulse_3.6s_ease-out_infinite] motion-reduce:animate-none"}
        style={{ width: "44%", aspectRatio: "1" }}
      />
    </span>
  )
}

/**
 * Marca de las pantallas de auth (login, signup, forgot/reset-password):
 * el isotipo real, monocromo, dentro de un aro circular — no un
 * monograma aparte. Único consumidor de la marca en las 4 pantallas de
 * auth, para que nadie vuelva a inventar un logo nuevo ahí.
 */
export function AuthMark({ size = 56 }: { size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full border border-border bg-secondary"
      style={{ width: size, height: size }}
    >
      <OrbitMark size={size * 0.5} mono />
    </span>
  )
}

export function BrandLogo({ size = 28, wordmarkSize = 15, iconOnly = false, mono = false }: { size?: number; wordmarkSize?: number; iconOnly?: boolean; mono?: boolean }) {
  if (iconOnly) return <OrbitMark size={size} mono={mono} />
  return (
    <span className="flex items-center gap-3">
      <OrbitMark size={size} mono={mono} />
      <span
        className="font-sans font-light uppercase leading-none tracking-[0.14em] text-foreground"
        style={{ fontSize: wordmarkSize }}
      >
        Smart<b className="font-extrabold tracking-[0.08em]">Scale</b>
      </span>
    </span>
  )
}
