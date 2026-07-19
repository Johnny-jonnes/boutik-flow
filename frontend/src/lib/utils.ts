import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * cn — fusionne des classes Tailwind en gérant les conflits (shadcn/ui standard).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
