import { NextResponse } from "next/server";
import {
  AuthenticationRequiredError,
  AuthorizationError,
  assertAppUserCanAccessSite,
  requireApiAppUser
} from "@/lib/auth/server";
import { createNewsInputSchema } from "@/lib/news/schemas";
import { createNewsPost } from "@/lib/news/service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const appUser = await requireApiAppUser();
    const body = await request.json();
    const parsedInput = createNewsInputSchema.safeParse(body);

    if (!parsedInput.success) {
      return NextResponse.json(
        { error: parsedInput.error.issues[0]?.message ?? "入力が不正です。" },
        { status: 400 }
      );
    }

    const site = await assertAppUserCanAccessSite(appUser, parsedInput.data.siteId);

    if (parsedInput.data.imageAssetId) {
      const supabase = createSupabaseAdminClient();
      const { data: asset, error: assetError } = await supabase
        .from("assets")
        .select("id,site_id")
        .eq("id", parsedInput.data.imageAssetId)
        .maybeSingle();

      if (assetError) {
        throw new Error(assetError.message);
      }

      if (!asset || asset.site_id !== site.id) {
        return NextResponse.json(
          { error: "指定した画像はこのサイトでは使えません。" },
          { status: 403 }
        );
      }
    }

    const result = await createNewsPost({
      clientId: site.client_id,
      siteId: parsedInput.data.siteId,
      userId: appUser.id,
      title: parsedInput.data.title,
      body: parsedInput.data.body,
      imageAssetId: parsedInput.data.imageAssetId ?? null,
      publish: parsedInput.data.publish
    });

    return NextResponse.json(
      {
        newsPost: result.newsPost,
        version: result.publishedVersion?.version ?? null,
        diff: result.publishedVersion?.diff ?? []
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "お知らせ投稿中に予期しないエラーが発生しました。"
      },
      { status: 500 }
    );
  }
}
