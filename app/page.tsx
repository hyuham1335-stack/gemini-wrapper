import { createClient } from "@/lib/supabase/server";
import { HeroSection } from "@/components/hero-section";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <HeroSection
      eyebrow="Gemini Wrapper"
      title="복잡한 설정 없이, 심플하게 Gemini를 사용하세요"
      description="API 키 발급 없이 구글 계정만으로 시작하세요. 대화는 서버에 암호화되어 저장되고, 월 정액 플랜으로 비용이 예측 가능합니다."
      primaryAction={
        user
          ? { text: "대시보드로 이동", href: "/dashboard" }
          : { text: "Google로 시작하기", href: "/login" }
      }
      secondaryAction={{ text: "요금제 보기", href: "/pricing" }}
    />
  );
}
