export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12 text-gray-900 leading-relaxed">
      <h1 className="text-2xl font-bold mb-10">OOFF 서비스 이용약관</h1>

      <div className="space-y-10 text-sm text-gray-800">
        <div className="bg-gray-50 p-4 rounded-lg text-xs text-gray-500 mb-8">
          <p>시행일: 2025. 01. 15</p>
          <p>운영자: OOFF 운영팀</p>
          <p>문의: ourownfilmfestival@gmail.com</p>
        </div>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">제1조 (목적)</h2>
          <p>
            이 약관은 OOFF가 제공하는 영화 기록 및 소셜 네트워크 서비스(이하 “서비스”) 이용과 관련하여, 
            운영자와 이용자(이하 “회원”)의 권리·의무 및 책임을 정합니다.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">제2조 (용어 정리)</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>회원:</strong> 이 약관에 동의하고 소셜 로그인으로 서비스에 가입해 사용하는 사람</li>
            <li><strong>계정:</strong> 회원이 서비스를 이용하기 위해 생성된 로그인 단위</li>
            <li><strong>콘텐츠:</strong> 회원이 서비스에 남기는 평점, 단평, 공개/비공개 설정, 프로필(닉네임·이미지·소개·링크 등), 팔로우 관계, 활동 기록 등 서비스 내 정보</li>
            <li><strong>관계 데이터:</strong> 팔로우/친구, 상호작용(좋아요 등), 피드 노출/열람 흐름 등 사람 간 연결과 이용 패턴에 관한 데이터</li>
            <li><strong>공개 콘텐츠:</strong> 회원이 공개 범위로 설정하여 다른 회원(또는 비회원)이 볼 수 있는 콘텐츠</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">제3조 (약관의 효력 및 변경)</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>운영자는 서비스 운영에 필요한 범위에서 약관을 바꿀 수 있습니다.</li>
            <li>중요한 변경(권리·의무에 큰 영향, 데이터 활용 범위 확대 등)은 적용일 최소 7일 전(회원에게 불리한 경우 최소 30일 전) 공지합니다.</li>
            <li>회원이 변경 약관 시행일 이후 서비스를 계속 이용하면, 변경에 동의한 것으로 봅니다.</li>
          </ol>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">제4조 (가입 및 이용 제한)</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>회원은 정확한 방식으로 가입해야 하며, 타인 계정 사용·도용은 금지됩니다.</li>
            <li>서비스는 원칙적으로 만 14세 이상을 대상으로 합니다. 만 14세 미만 이용이 확인되면 법정대리인 동의 확인이 어려운 경우 계정을 제한하거나 삭제할 수 있습니다.</li>
          </ol>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">제5조 (계정 관리 및 보안)</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>회원은 본인 계정 정보를 제3자에게 양도·대여·공유할 수 없습니다.</li>
            <li>운영자는 보안상 필요 시 비정상 로그인 차단, 추가 확인 등을 할 수 있습니다.</li>
          </ol>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">제6조 (서비스 기능)</h2>
          <p>운영자는 다음 기능을 제공합니다 (변경 가능):</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>영화(및 영화제) 기록: 평점, 단평, 리스트 등</li>
            <li>소셜 기능: 팔로우/친구, 피드, 공개 프로필 등</li>
            <li>검색/추천: 관계성과 이용 패턴 기반의 노출/추천</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">제7조 (금지 행위)</h2>
          <p>회원은 아래 행위를 해서는 안 됩니다.</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>불법 콘텐츠 게시, 타인의 권리(저작권·초상권·명예 등) 침해</li>
            <li>욕설·혐오·괴롭힘·스토킹 등 타인에게 피해를 주는 행위</li>
            <li>서비스/서버를 방해하는 행위(자동화 스크래핑, 과도한 요청, 취약점 공격 등)</li>
            <li>허위 정보로 타인을 기만하거나, 관계성 데이터를 조작하는 행위</li>
          </ul>
          <p className="mt-2 text-xs text-gray-500">운영자는 위반 정도에 따라 콘텐츠 삭제, 노출 제한, 이용 정지, 계정 삭제를 할 수 있습니다.</p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">제8조 (콘텐츠의 권리와 사용 허락)</h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>회원이 작성한 콘텐츠의 권리는 원칙적으로 회원에게 있습니다.</li>
            <li>
              다만, 서비스 제공을 위해 회원은 운영자에게 다음 범위의 <strong>무상·전세계적 사용 허락(라이선스)</strong>을 부여합니다.
              <ul className="list-disc pl-5 mt-1 text-gray-600">
                <li>저장, 복제, 전송, 표시, 기능 구현(피드 노출·검색·추천·백업 등)</li>
                <li>서비스 안정화/개선(품질 분석, 스팸·어뷰징 탐지 등)</li>
              </ul>
            </li>
            <li>운영자는 회원의 닉네임·프로필·원문 콘텐츠를 그대로 외부 광고/홍보에 사용하는 일을 원칙적으로 하지 않습니다. 필요 시 별도 동의를 받습니다.</li>
          </ol>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">제9조 (공개 범위와 책임)</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>회원은 콘텐츠의 공개 범위를 설정할 수 있으며, 공개로 설정한 콘텐츠는 다른 이용자가 볼 수 있고 공유될 수 있습니다.</li>
            <li>공개 콘텐츠로 인해 발생하는 제3자의 열람·공유에 대해서는 서비스가 통제하기 어렵습니다. 회원은 공개 설정 시 이를 고려해야 합니다.</li>
          </ol>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">제10조 (관계성/활동 데이터의 비식별 분석 및 제공)</h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>OOFF의 핵심은 개인 프로필 정보가 아니라 <strong>관계성과 이용 패턴(관계 데이터)</strong>입니다. 운영자는 불필요한 개인정보를 수집하지 않는 것을 원칙으로 합니다.</li>
            <li>
              운영자는 서비스 운영·개선 및 향후 비즈니스(예: 영화 취향/관계성 인사이트) 목적으로, 회원의 관계 데이터와 활동 데이터를 <strong>개인을 알아볼 수 없게 가공한 형태(비식별/집계)</strong>로 분석하거나 통계를 만들 수 있습니다.
            </li>
            <li>
              또한 운영자는 위와 같이 비식별/집계된 통계를 제3자에게 제공하거나 판매할 수 있습니다. 이때 운영자는 다음 원칙을 지킵니다.
              <ul className="list-disc pl-5 mt-1 text-gray-600">
                <li>이메일/닉네임 등 직접 식별 정보는 포함하지 않음(또는 강하게 암호화/해시 처리)</li>
                <li>소수 집단은 묶어서 표시하는 등 재식별 위험을 낮추는 방식으로 제공</li>
                <li>개인 단위 프로파일링/개인 식별 목적의 제공은 하지 않음</li>
              </ul>
            </li>
            <li>회원은 위 범위의 활용 가능성에 동의합니다.</li>
          </ol>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">제11조 (서비스 변경·중단)</h2>
          <p>운영자는 기능 개선, 정책 변경, 기술적 문제 등으로 서비스의 전부 또는 일부를 변경/중단할 수 있습니다. 중대한 중단이 예상되는 경우 가능한 범위에서 사전 공지합니다.</p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">제12조 (탈퇴 및 데이터 처리)</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>회원은 언제든지 서비스 내 기능(설정/탈퇴)으로 탈퇴할 수 있습니다.</li>
            <li>
              탈퇴 시 운영자는 회원의 개인정보 및 회원 계정을 식별할 수 있는 정보는 지체 없이 삭제합니다. 다만, 아래는 예외로 남을 수 있습니다.
              <ul className="list-disc pl-5 mt-1 text-gray-600">
                <li>법령 준수를 위해 보관이 필요한 로그/기록</li>
                <li>이미 비식별/집계로 전환되어 개인을 특정할 수 없는 통계 데이터</li>
                <li>기술적 백업(접근 제한된 상태로 백업 주기 종료 시 순차 삭제)</li>
              </ul>
            </li>
          </ol>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">제13조 (책임 제한)</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>운영자는 무료로 제공되는 서비스에 대해 법령이 허용하는 범위에서 책임을 제한할 수 있습니다.</li>
            <li>운영자는 회원의 귀책(계정 공유, 부주의, 불법 게시물 등)으로 발생한 손해에 대해 책임지지 않습니다.</li>
          </ol>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">제14조 (준거법 및 분쟁)</h2>
          <p>이 약관은 대한민국 법령을 따르며, 분쟁은 운영자 주소지 관할 법원을 1심 전속 관할로 할 수 있습니다.</p>
        </section>
      </div>
    </main>
  );
}