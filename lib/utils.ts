import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Versión declarada del producto — única fuente de verdad (chip del sidebar,
 *  subtítulo del header). No hardcodear "2.0"/"3.0" en otro lado. */
export const APP_VERSION = "3.0"
