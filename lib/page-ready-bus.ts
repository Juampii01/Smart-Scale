type Cb = () => void
const listeners = new Set<Cb>()

export const pageReadyBus = {
  on(cb: Cb): () => void {
    listeners.add(cb)
    return () => listeners.delete(cb)
  },
  emit() {
    listeners.forEach((cb) => cb())
    listeners.clear()
  },
}
