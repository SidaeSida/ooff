export default function NotFound() {
  return (
    <main style={{minHeight:'70vh',display:'grid',placeItems:'center',padding:'4rem 1rem'}}>
      <div style={{maxWidth:560}}>
        <h1 style={{fontSize:'2rem',marginBottom:'0.75rem'}}>페이지를 찾을 수 없습니다</h1>
        <p style={{lineHeight:1.6,marginBottom:'1rem'}}>
          주소가 변경되었거나 일시적으로 사용할 수 없습니다. 상단 메뉴 또는 홈으로 이동해 주세요.
        </p>
        <a href="/" style={{textDecoration:'underline'}}>홈으로 이동</a>
      </div>
    </main>
  );
}
