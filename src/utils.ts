import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export function shouldNavigateInPlace(e: React.MouseEvent): boolean {
  return !(e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0);
}
