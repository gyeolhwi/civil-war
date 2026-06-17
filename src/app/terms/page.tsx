export const metadata = {
  title: "이용약관 — 내전",
};

const UPDATED = "2026-06-17";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-sm leading-relaxed">
      <h1 className="text-2xl font-bold">이용약관</h1>
      <p className="mt-1 text-xs text-muted-foreground">시행일: {UPDATED}</p>

      <section className="mt-8 space-y-6">
        <div>
          <h2 className="font-semibold">제1조 (목적)</h2>
          <p className="mt-1 text-muted-foreground">
            본 약관은 운영자(이하 "운영자")가 제공하는 오버워치 디스코드 채널
            내전 편성·관리 서비스(이하 "서비스")의 이용 조건 및 절차, 이용자와
            운영자의 권리·의무·책임사항을 규정함을 목적으로 합니다.
          </p>
        </div>

        <div>
          <h2 className="font-semibold">제2조 (정의)</h2>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>
              "서비스": 내전 참가자 모집·팀 편성·전적 관리 및 디스코드 봇 연동
              기능.
            </li>
            <li>
              "이용자": 본 약관에 따라 서비스를 이용하는 채널 관리자 및 참가자.
            </li>
            <li>"채널": 디스코드 서버 단위로 운영되는 내전 단위.</li>
          </ul>
        </div>

        <div>
          <h2 className="font-semibold">제3조 (약관의 효력 및 변경)</h2>
          <p className="mt-1 text-muted-foreground">
            본 약관은 서비스 화면에 게시함으로써 효력이 발생합니다. 운영자는
            관련 법령을 위반하지 않는 범위에서 약관을 변경할 수 있으며, 변경 시
            서비스 내 공지합니다.
          </p>
        </div>

        <div>
          <h2 className="font-semibold">제4조 (서비스의 내용)</h2>
          <p className="mt-1 text-muted-foreground">
            서비스는 비영리·무료로 제공되며, 내전 참가자 관리, 자동/팀장
            드래프트 기반 팀 밸런싱, 맵 선정, 전적·통계, 디스코드 슬래시 커맨드
            및 공지 기능을 포함합니다. 운영자는 서비스의 내용을 변경하거나
            중단할 수 있습니다.
          </p>
        </div>

        <div>
          <h2 className="font-semibold">제5조 (이용자의 의무)</h2>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>
              타인의 배틀태그·디스코드 계정 등 정보를 무단으로 등록하지
              않습니다.
            </li>
            <li>서비스의 정상적인 운영을 방해하는 행위를 하지 않습니다.</li>
            <li>관련 법령 및 본 약관, 디스코드 이용약관을 준수합니다.</li>
          </ul>
        </div>

        <div>
          <h2 className="font-semibold">제6조 (금지행위)</h2>
          <p className="mt-1 text-muted-foreground">
            이용자는 서비스를 역설계·자동화 공격·무단 데이터 수집 등에
            이용하거나, 타인의 권리를 침해하는 행위를 해서는 안 됩니다.
          </p>
        </div>

        <div>
          <h2 className="font-semibold">제7조 (서비스의 중단·변경)</h2>
          <p className="mt-1 text-muted-foreground">
            운영자는 시스템 점검, 외부 서비스(디스코드·호스팅 등) 장애, 기타
            불가피한 사유로 서비스 제공을 일시 중단하거나 종료할 수 있습니다.
          </p>
        </div>

        <div>
          <h2 className="font-semibold">제8조 (책임 제한 및 면책)</h2>
          <p className="mt-1 text-muted-foreground">
            본 서비스는 개인이 비영리로 제공하는 무료 서비스로서, 관련 법령이
            허용하는 범위에서 서비스의 완전성·정확성·가용성을 보증하지 않으며,
            서비스 이용으로 발생한 손해에 대해 고의 또는 중대한 과실이 없는 한
            책임을 지지 않습니다. 디스코드·블리자드 등 제3자 서비스 및 게임
            콘텐츠는 각 권리자에게 귀속됩니다.
          </p>
        </div>

        <div>
          <h2 className="font-semibold">제9조 (게시물·콘텐츠)</h2>
          <p className="mt-1 text-muted-foreground">
            패치노트 등 운영자가 게시하는 콘텐츠의 출처는 해당 출처에 귀속되며,
            서비스는 정보 제공 목적으로 이를 정리·표시합니다.
          </p>
        </div>

        <div>
          <h2 className="font-semibold">제10조 (준거법 및 관할)</h2>
          <p className="mt-1 text-muted-foreground">
            본 약관은 대한민국 법령에 따라 해석되며, 서비스 이용과 관련한 분쟁은
            관련 법령에 따른 관할 법원에 제기합니다.
          </p>
        </div>

        <div>
          <h2 className="font-semibold">문의</h2>
          <p className="mt-1 text-muted-foreground">
            운영자: gyeolhwi (GitHub) · 연락처: 디스코드 gyeorrr
          </p>
        </div>

        <p className="text-xs text-muted-foreground">
          부칙: 본 약관은 {UPDATED}부터 시행합니다.
        </p>
      </section>
    </main>
  );
}
