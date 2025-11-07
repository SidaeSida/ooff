'use client';

import { useEffect } from 'react';

export default function NoScroll() {
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add('no-scroll');
    return () => { html.classList.remove('no-scroll'); };
  }, []);
  return null;
}
