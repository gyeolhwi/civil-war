export const metadata = {
  title: "개인정보처리방침 — 내전",
};

const UPDATED = "2026-06-17";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-sm leading-relaxed">
      <h1 className="text-2xl font-bold">개인정보처리방침</h1>
      <p className="mt-1 text-xs text-muted-foreground">시행일: {UPDATED}</p>
      <p className="mt-4 text-muted-foreground">
        본 서비스(오버워치 디스코드 내전 편성·관리, 이하 "서비스")는 「개인정보
        보호법」을 준수하며, 이용자의 개인정보를 다음과 같이 처리합니다. 본
        서비스는 개인이 비영리로 운영하며, 별도의 상호·사업자 등록은 없습니다.
      </p>

      <section className="mt-8 space-y-6">
        <div>
          <h2 className="font-semibold">1. 처리하는 개인정보 항목</h2>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>
              참가자 프로필: 배틀태그, 디스코드 닉네임·사용자 ID, 주/부 포지션,
              역할별 티어, 선호 영웅·맵
            </li>
            <li>관리자 계정: 이메일(로그인용), 인증 정보</li>
            <li>
              자동 수집: 로그인 세션 유지를 위한 쿠키, 서비스 이용 중 발생하는
              접속 기록
            </li>
          </ul>
        </div>

        <div>
          <h2 className="font-semibold">2. 개인정보의 처리 목적</h2>
          <p className="mt-1 text-muted-foreground">
            내전 참가자 관리, 팀 편성·밸런싱, 전적·통계 제공, 디스코드 연동(모집
            공지·프로필 등록), 관리자 인증 및 서비스 운영.
          </p>
        </div>

        <div>
          <h2 className="font-semibold">3. 처리 및 보유 기간</h2>
          <p className="mt-1 text-muted-foreground">
            수집·이용 목적 달성 시 또는 멤버·채널 삭제, 관리자 계정 탈퇴, 동의
            철회 시까지 보유하며, 이후 지체 없이 파기합니다. 관련 법령에서
            보존을 요구하는 경우 해당 기간 동안 보관합니다.
          </p>
        </div>

        <div>
          <h2 className="font-semibold">4. 개인정보의 제3자 제공</h2>
          <p className="mt-1 text-muted-foreground">
            운영자는 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만
            법령에 근거가 있는 경우는 예외로 합니다.
          </p>
        </div>

        <div>
          <h2 className="font-semibold">5. 처리의 위탁 및 국외 이전</h2>
          <p className="mt-1 text-muted-foreground">
            서비스 운영을 위해 아래와 같이 처리를 위탁하며, 이들 사업자는 서버를
            국외에 둘 수 있습니다. (서버 인프라 이용으로 데이터가 국외에
            저장·처리될 수 있음)
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Supabase, Inc. — 데이터베이스 저장 및 관리자 인증</li>
            <li>Vercel, Inc. — 웹 애플리케이션 호스팅</li>
            <li>Discord, Inc. — 디스코드 봇 연동(슬래시 커맨드·메시지)</li>
          </ul>
        </div>

        <div>
          <h2 className="font-semibold">
            6. 정보주체의 권리·의무 및 행사 방법
          </h2>
          <p className="mt-1 text-muted-foreground">
            이용자는 언제든지 본인 개인정보의 열람·정정·삭제·처리정지를 요구할
            수 있습니다. 채널 관리자에게 요청하거나 아래 연락처로 문의하면 지체
            없이 조치합니다.
          </p>
        </div>

        <div>
          <h2 className="font-semibold">7. 개인정보의 파기</h2>
          <p className="mt-1 text-muted-foreground">
            보유 기간 경과 또는 처리 목적 달성 시 전자적 파일은 복구가 불가능한
            방법으로 삭제합니다.
          </p>
        </div>

        <div>
          <h2 className="font-semibold">8. 안전성 확보 조치</h2>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>
              접근 권한 통제(데이터베이스 행 수준 보안, RLS) 및 관리자 2단계
              인증
            </li>
            <li>전송 구간 암호화(HTTPS) 및 최소 수집 원칙 적용</li>
          </ul>
        </div>

        <div>
          <h2 className="font-semibold">9. 쿠키 등 자동 수집 장치</h2>
          <p className="mt-1 text-muted-foreground">
            로그인 세션 유지를 위해 쿠키를 사용합니다. 이용자는 브라우저
            설정에서 쿠키 저장을 거부할 수 있으며, 이 경우 로그인 등 일부 기능
            이용이 제한될 수 있습니다.
          </p>
        </div>

        <div>
          <h2 className="font-semibold">10. 개인정보 보호책임자 및 문의처</h2>
          <p className="mt-1 text-muted-foreground">
            개인정보 보호책임자: gyeolhwi (GitHub)
            <br />
            연락처: 디스코드 gyeorrr
          </p>
        </div>

        <div>
          <h2 className="font-semibold">11. 권익침해 구제 방법</h2>
          <p className="mt-1 text-muted-foreground">
            개인정보 침해로 인한 상담·신고는 아래 기관에 문의할 수 있습니다.
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>개인정보분쟁조정위원회 (kopico.go.kr / 1833-6972)</li>
            <li>개인정보침해신고센터 (privacy.kisa.or.kr / 118)</li>
            <li>대검찰청 사이버수사과 (1301), 경찰청 사이버수사국 (182)</li>
          </ul>
        </div>

        <p className="text-xs text-muted-foreground">
          본 방침은 {UPDATED}부터 시행하며, 내용 변경 시 서비스 내 공지합니다.
        </p>
      </section>
    </main>
  );
}
