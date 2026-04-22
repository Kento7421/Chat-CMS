import type { PublicSiteSnapshot } from "@/types/domain";

export const demoSnapshots: PublicSiteSnapshot[] = [
  {
    id: "site_demo_001",
    slug: "demo-company",
    name: "デモ株式会社",
    templateName: "simple-corporate-v1",
    hero: {
      title: "Webが苦手でも更新できるホームページへ",
      copy: "チャットで指示するだけで、サイト文言やお知らせを安全に更新できるCMSを目指します。"
    },
    contact: {
      phone: "03-1234-5678",
      email: "hello@example.com",
      businessHours: "平日 09:00 - 18:00"
    }
  }
];
