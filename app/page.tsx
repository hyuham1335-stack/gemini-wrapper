import { HeroSection } from "@/components/hero-section";

export default function Home() {
  return (
    <HeroSection
      eyebrow="Gemini Wrapper"
      title="복잡한 설정 없이, 심플하게 Gemini를 사용하세요"
      description="API 키 발급부터 프롬프트 관리까지, Gemini를 더 빠르고 쉽게 쓸 수 있도록 감싼 서비스입니다."
      primaryAction={{ text: "시작하기", href: "/login" }}
      secondaryAction={{ text: "더 알아보기", href: "#features" }}
    />
  );
}
