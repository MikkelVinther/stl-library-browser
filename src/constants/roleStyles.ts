import { Box, Layers, File, Tag } from 'lucide-react';
import type { FC, SVGProps } from 'react';

export const ROLE_STYLES: Record<string, { gradient: string; badge: string }> = {
  scatter:   { gradient: 'from-emerald-800 to-green-700',  badge: 'bg-emerald-700' },
  tile:      { gradient: 'from-indigo-800 to-blue-700',    badge: 'bg-indigo-600'  },
  terrain:   { gradient: 'from-slate-700 to-slate-600',    badge: 'bg-slate-600'   },
  prop:      { gradient: 'from-amber-800 to-orange-700',   badge: 'bg-amber-700'   },
  monster:   { gradient: 'from-red-800 to-rose-700',       badge: 'bg-red-700'     },
  miniature: { gradient: 'from-purple-800 to-violet-700',  badge: 'bg-purple-700'  },
  base:      { gradient: 'from-cyan-800 to-teal-700',      badge: 'bg-cyan-700'    },
};

export const DEFAULT_STYLE = { gradient: 'from-gray-800 to-gray-700', badge: 'bg-gray-600' };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ROLE_ICON_MAP: Record<string, FC<SVGProps<SVGSVGElement> & { className?: string }>> = {
  terrain: Box as any,
  tile: Layers as any,
  prop: File as any,
  scatter: Tag as any,
};

export function getRoleStyle(role: string | undefined): { gradient: string; badge: string } {
  return (role && ROLE_STYLES[role]) || DEFAULT_STYLE;
}
