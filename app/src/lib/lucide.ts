import * as lucide from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

/**
 * Dynamic lucide lookup for API-driven icon names (subjects send kebab-case
 * names like "flask-conical"). Falls back to BookOpen for unknown names.
 */

const registry = lucide as unknown as Record<string, LucideIcon | undefined>;

/** "flask-conical" -> "FlaskConical", "grid-2x2" -> "Grid2x2". */
export function toPascalCase(name: string): string {
  return name
    .trim()
    .split(/[-_ ]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

export function getLucideIcon(
  name: string | null | undefined,
  fallback: LucideIcon = lucide.BookOpen,
): LucideIcon {
  if (!name) return fallback;
  const icon = registry[toPascalCase(name)];
  return icon ?? fallback;
}
