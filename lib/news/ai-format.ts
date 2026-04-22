type FormatNewsDraftInput = {
  title: string;
  body: string;
};

export async function requestAiNewsFormatting(input: FormatNewsDraftInput) {
  return {
    title: input.title,
    body: input.body,
    message: "AI整形は後続タスクで接続予定です。現状は呼び出し雛形のみです。"
  };
}
