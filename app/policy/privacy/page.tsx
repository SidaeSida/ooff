export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12 text-gray-900 leading-relaxed">
      <h1 className="text-2xl font-bold mb-10">OOFF 개인정보처리방침</h1>

      <div className="space-y-10 text-sm text-gray-800">
        <div className="bg-gray-50 p-4 rounded-lg text-xs text-gray-500 mb-8">
          <p>시행일: 2025. 01. 15</p>
          <p>개인정보처리자: OOFF 운영팀</p>
          <p>문의: ourownfilmfestival@gmail.com</p>
        </div>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">1. OOFF의 기본 원칙</h2>
          <p>OOFF는 나이·성별·거주지·실명 같은 정보는 수집하지 않습니다. 서비스의 핵심은 <strong>관계성(팔로우/상호작용)과 취향 데이터(평점/단평)</strong>이며, 개인정보는 최소화합니다.</p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">2. 수집하는 정보 (최소 수집)</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>가입/로그인 시 (필수):</strong> 소셜 로그인 제공자가 발급하는 고유 식별자(OAuth Provider User ID), 로그인 제공자 종류
              <br />
              <span className="text-gray-500 text-xs">* 이메일은 기본 식별값으로 사용하지 않고 저장하지 않는 것을 원칙으로 합니다. (문의 응대 시 예외)</span>
            </li>
            <li>
              <strong>직접 입력 (선택):</strong> 닉네임, 프로필 이미지, 자기소개(Bio), 외부 SNS 링크(Letterboxd 등)
            </li>
            <li>
              <strong>자동 수집:</strong> 접속 로그, IP, 쿠키/세션 정보, 기기 정보, 오류 기록, 서비스 내 활동 기록(콘텐츠, 팔로우 관계 등)
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">3. 이용 목적</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>서비스 제공:</strong> 로그인, 콘텐츠 저장/표시, 친구/피드/추천 기능 제공</li>
            <li><strong>보안/안정성:</strong> 부정 이용 방지, 계정 보호, 장애 대응</li>
            <li><strong>서비스 개선:</strong> 기능 품질 분석, 통계 작성(가능한 범위에서 비식별/집계)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">4. 보관 기간</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>원칙:</strong> 목적 달성 시 지체 없이 삭제</li>
            <li><strong>탈퇴 시:</strong> 계정 식별 정보 및 프로필 등 개인정보는 즉시 삭제</li>
            <li>단, 보안 및 내부 통제 목적의 접속기록 등은 관련 법령 기준에 따라 일정 기간 보관할 수 있습니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">5. 제3자 제공</h2>
          <p>OOFF는 원칙적으로 개인정보를 외부에 제공하지 않습니다. 다만, 다음 경우는 예외입니다.</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>법령에 따른 요청이 있는 경우</li>
            <li>서비스 양수·양도/합병 등으로 운영 주체가 바뀌는 경우 (사전 공지)</li>
            <li><strong>개인을 알아볼 수 없게 가공한 통계/인사이트를 제공·판매하는 경우</strong> (개인정보가 아닌 형태로 제공)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">6. 처리 위탁 및 국외 이전</h2>
          <p>서비스 운영을 위해 인프라 호스팅, 데이터베이스 운영 등을 클라우드 사업자에게 위탁할 수 있습니다.</p>
          <p className="mt-1 text-gray-600">- 위탁 대상: Vercel, Neon (AWS) 등</p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">7. 이용자의 권리</h2>
          <p>회원은 내 정보 열람/정정/삭제, 처리 정지 요구, 회원 탈퇴(계정 삭제)를 요청할 수 있습니다.</p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">8. 쿠키(세션) 사용</h2>
          <p>로그인 유지, 보안, 기본 기능 제공을 위해 쿠키를 사용합니다. 브라우저 설정으로 거부할 수 있으나 일부 기능이 제한될 수 있습니다.</p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">9. 안전성 확보 조치</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>접근 권한 통제(최소 권한), 내부 접근 기록 관리</li>
            <li>전송/저장 구간 보호(암호화)</li>
            <li>취약점 점검 및 이상 징후 모니터링</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">10. 권익침해 구제 방법</h2>
          <p>개인정보 침해로 상담이 필요한 경우 한국인터넷진흥원(KISA) 등에 문의할 수 있습니다.</p>
        </section>
      </div>
    </main>
  );
}