'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // 로그가 필요하면 여기서 error를 전송(예: Sentry)
  console.error(error);

  return (
    <main style={{minHeight:'70vh',display:'grid',placeItems:'center',padding:'4rem 1rem'}}>
      <div style={{maxWidth:560}}>
        <h1 style={{fontSize:'2rem',marginBottom:'0.75rem'}}>문제가 발생했습니다</h1>
        <p style={{lineHeight:1.6,marginBottom:'1rem'}}>
          잠시 후 다시 시도해 주세요. 문제가 계속되면 홈으로 이동하시거나 새로고침해 주세요.
        </p>
        <div style={{display:'flex',gap:'0.75rem'}}>
          <button onClick={() => reset()} style={{padding:'0.5rem 1rem',border:'1px solid #ddd',borderRadius:8}}>
            다시 시도
          </button>
          <a href="/" style={{textDecoration:'underline',alignSelf:'center'}}>홈으로 이동</a>
        </div>
      </div>
    </main>
  );
}
