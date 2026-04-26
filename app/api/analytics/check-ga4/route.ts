import { NextResponse } from "next/server";
import {
  AuthenticationRequiredError,
  AuthorizationError,
  requireApiAppUser
} from "@/lib/auth/server";
import { getAnalyticsConnectionStatusForAppUser } from "@/lib/analytics/service";
import { analyticsConnectionCheckInputSchema } from "@/lib/analytics/schemas";

export async function POST(request: Request) {
  try {
    const appUser = await requireApiAppUser();
    const body = await request.json();
    const parsed = analyticsConnectionCheckInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" },
        { status: 400 }
      );
    }

    const result = await getAnalyticsConnectionStatusForAppUser(appUser, parsed.data.siteId);

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
            : "GA4 接続確認中にエラーが発生しました。"
      },
      { status: 500 }
    );
  }
}
