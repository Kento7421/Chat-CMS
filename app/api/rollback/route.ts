import { NextResponse } from "next/server";
import {
  AuthenticationRequiredError,
  AuthorizationError,
  requireApiAppUser
} from "@/lib/auth/server";
import { rollbackInputSchema } from "@/lib/versions/schemas";
import { executeRollbackForAppUser } from "@/lib/versions/service";

export async function POST(request: Request) {
  try {
    const appUser = await requireApiAppUser();
    const body = await request.json();
    const parsed = rollbackInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "入力が不正です。" },
        { status: 400 }
      );
    }

    const result = await executeRollbackForAppUser(appUser, parsed.data);

    return NextResponse.json({
      message: `Version ${result.version.version_number} を作成してロールバックしました。`,
      version: result.version,
      diff: result.diff
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
            : "ロールバック中に予期しないエラーが発生しました。"
      },
      { status: 500 }
    );
  }
}
