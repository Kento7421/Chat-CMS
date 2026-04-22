import { NextResponse } from "next/server";
import { z } from "zod";
import {
  AuthenticationRequiredError,
  AuthorizationError,
  assertAppUserCanAccessSite,
  requireApiAppUser
} from "@/lib/auth/server";
import { uploadAsset } from "@/lib/assets/service";
import { assetUploadInputSchema } from "@/lib/assets/schemas";

const imageMimeTypeSchema = z.string().startsWith("image/");

export async function POST(request: Request) {
  try {
    const appUser = await requireApiAppUser();
    const formData = await request.formData();
    const fileEntry = formData.get("file");

    if (!(fileEntry instanceof File)) {
      return NextResponse.json({ error: "画像ファイルを指定してください。" }, { status: 400 });
    }

    const parsedInput = assetUploadInputSchema.safeParse({
      siteId: formData.get("siteId"),
      altText: formData.get("altText") || null,
      width: toOptionalNumber(formData.get("width")),
      height: toOptionalNumber(formData.get("height"))
    });

    if (!parsedInput.success) {
      return NextResponse.json(
        { error: parsedInput.error.issues[0]?.message ?? "入力が不正です。" },
        { status: 400 }
      );
    }

    if (!imageMimeTypeSchema.safeParse(fileEntry.type).success) {
      return NextResponse.json(
        { error: "画像ファイルのみアップロードできます。" },
        { status: 400 }
      );
    }

    const site = await assertAppUserCanAccessSite(appUser, parsedInput.data.siteId);
    const result = await uploadAsset({
      clientId: site.client_id,
      siteId: parsedInput.data.siteId,
      userId: appUser.id,
      altText: parsedInput.data.altText ?? null,
      width: parsedInput.data.width ?? null,
      height: parsedInput.data.height ?? null,
      file: fileEntry
    });

    return NextResponse.json(result, { status: 201 });
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
            : "画像アップロード中に予期しないエラーが発生しました。"
      },
      { status: 500 }
    );
  }
}

function toOptionalNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
