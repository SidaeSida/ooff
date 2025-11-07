'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * iOS Safari 등의 BFCache 복원(pageshow.persisted) 시
 * 라우터를 강제 새로고침하여 이벤트/상태 갱신.
 */
export default function PageShowRefresh() {
  const router = useRouter();

  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      // 뒤로/앞으로로 복원된 경우에만
      if ((e as any).persisted) router.refresh();
    };
    window.addEventListener('pageshow', onPageShow as any);
    return () => window.removeEventListener('pageshow', onPageShow as any);
  }, [router]);

  return null;
}
