import { NextResponse } from "next/server";
import {
  AuthenticationRequiredError,
  AuthorizationError,
  requireApiAppUser
} from "@/lib/auth/server";
import { analyticsSettingsUpdateInputSchema } from "@/lib/analytics/schemas";
import { updateAnalyticsSettingsForAppUser } from "@/lib/analytics/service";

export async function POST(request: Request) {
  try {
    const appUser = await requireApiAppUser();
    const body = await request.json();
    const parsed = analyticsSettingsUpdateInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" },
        { status: 400 }
      );
    }

    const result = await updateAnalyticsSettingsForAppUser(appUser, parsed.data);

    return NextResponse.json({
      message: "アクセス状況の設定を保存しました。",
      ...result
    });
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
            : "アクセス状況の設定保存中にエラーが発生しました。"
      },
      { status: 500 }
    );
  }
}
