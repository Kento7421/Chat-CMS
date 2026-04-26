import type { SiteSnapshot } from "@/types/domain";

export type DemoPublicSite = {
  slug: string;
  siteName: string;
  snapshot: SiteSnapshot;
};

export const demoSites: DemoPublicSite[] = [
  {
    slug: "demo-company",
    siteName: "デモ株式会社",
    snapshot: {
      schemaVersion: "2026-04-22",
      templateVersion: "simple-corporate-v1",
      siteId: "site_demo_001",
      templateId: "template_simple_corporate_v1",
      siteName: "デモ株式会社",
      navigation: [
        { label: "Home", href: "/" },
        { label: "About", href: "/about" },
        { label: "News", href: "/news" },
        { label: "Contact", href: "/contact" }
      ],
      theme: {
        accentColor: "#0f766e",
        backgroundColor: "#f8f5ef",
        textColor: "#101828"
      },
      contact: {
        phone: "03-1234-5678",
        email: "hello@example.com",
        businessHours: "平日 09:00 - 18:00"
      },
      pages: [
        {
          key: "home",
          title: "トップページ",
          sections: [
            {
              id: "hero",
              heading: "Webが苦手でも、自分たちで更新できるホームページへ",
              body:
                "チャットで更新指示を出すだけで、文章変更やお知らせ更新を安心して進められる仕組みを提供します。"
            }
          ]
        },
        {
          key: "about",
          title: "会社概要",
          sections: [
            {
              id: "company-overview",
              heading: "私たちについて",
              body:
                "中小企業の情報発信を、専門知識に頼りすぎず続けられる形に整えることを大切にしています。"
            }
          ]
        },
        {
          key: "contact",
          title: "お問い合わせ",
          sections: [
            {
              id: "contact-info",
              heading: "お問い合わせ",
              body: "ご相談や導入のご質問は、お電話またはメールからお気軽にお問い合わせください。"
            }
          ]
        },
        {
          key: "news",
          title: "お知らせ",
          sections: [
            {
              id: "news-intro",
              heading: "お知らせ",
              body: "最新のお知らせや更新情報をご案内します。"
            }
          ]
        }
      ],
      news: [],
      assets: [],
      assetIds: []
    }
  }
];
