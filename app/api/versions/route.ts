import { NextResponse } from "next/server";
import {
  AuthenticationRequiredError,
  AuthorizationError,
  requireApiAppUser
} from "@/lib/auth/server";
import { versionsQuerySchema } from "@/lib/versions/schemas";
import { listSiteVersionsForAppUser } from "@/lib/versions/service";

export async function GET(request: Request) {
  try {
    const appUser = await requireApiAppUser();
    const { searchParams } = new URL(request.url);
    const parsed = versionsQuerySchema.safeParse({
      siteId: searchParams.get("siteId") ?? undefined
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "siteId が不正です。" },
        { status: 400 }
      );
    }

    const result = await listSiteVersionsForAppUser(appUser, parsed.data.siteId);
    return NextResponse.json(result);
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
            : "履歴一覧の取得中に予期しないエラーが発生しました。"
      },
      { status: 500 }
    );
  }
}
