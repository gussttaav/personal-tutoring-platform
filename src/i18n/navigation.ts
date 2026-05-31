import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

// Locale-aware navigation primitives — used by internal links from Phase 2 onward.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
