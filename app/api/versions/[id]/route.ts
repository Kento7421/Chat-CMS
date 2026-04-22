import { NextResponse } from "next/server";
import { z } from "zod";
import {
  AuthenticationRequiredError,
  AuthorizationError,
  requireApiAppUser
} from "@/lib/auth/server";
import { getSiteVersionDetailForAppUser } from "@/lib/versions/service";

const paramsSchema = z.object({
  id: z.string().uuid()
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const appUser = await requireApiAppUser();
    const parsedParams = paramsSchema.safeParse(await context.params);

    if (!parsedParams.success) {
      return NextResponse.json({ error: "versionId が不正です。" }, { status: 400 });
    }

    const result = await getSiteVersionDetailForAppUser(appUser, parsedParams.data.id);
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
            : "バージョン詳細の取得中に予期しないエラーが発生しました。"
      },
      { status: 500 }
    );
  }
}
