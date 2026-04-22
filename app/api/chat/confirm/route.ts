import { NextResponse } from "next/server";
import {
  AuthenticationRequiredError,
  AuthorizationError,
  requireApiAppUser
} from "@/lib/auth/server";
import { ChatFlowError, chatConfirmInputSchema, confirmChangeSetForAppUser } from "@/lib/chat";
import { ChangeSetAlreadyAppliedError, VersionConflictError } from "@/lib/versioning";

export async function POST(request: Request) {
  try {
    const appUser = await requireApiAppUser();
    const body = await request.json();
    const parsed = chatConfirmInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "入力内容が不正です。" },
        { status: 400 }
      );
    }

    const result = await confirmChangeSetForAppUser(appUser, parsed.data);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error instanceof ChangeSetAlreadyAppliedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    if (error instanceof VersionConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    if (error instanceof ChatFlowError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "公開処理中にエラーが発生しました。"
      },
      { status: 500 }
    );
  }
}
