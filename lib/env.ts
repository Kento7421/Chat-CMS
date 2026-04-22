import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default("Chat CMS"),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1)
});

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_ASSETS_BUCKET: z.string().min(1).default("site-assets"),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().min(1).default("gpt-4o-mini"),
  SITE_PREVIEW_ORIGIN: z.string().url().optional()
});

type PublicEnv = z.infer<typeof publicEnvSchema>;
type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedPublicEnv: PublicEnv | null = null;
let cachedServerEnv: ServerEnv | null = null;

function formatZodError(error: z.ZodError) {
  return error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
}

export function getPublicEnv() {
  if (cachedPublicEnv) {
    return cachedPublicEnv;
  }

  const result = publicEnvSchema.safeParse(process.env);

  if (!result.success) {
    throw new Error(
      `Public environment variables are invalid:\n${formatZodError(result.error)}`
    );
  }

  cachedPublicEnv = result.data;
  return cachedPublicEnv;
}

export function getServerEnv() {
  if (cachedServerEnv) {
    return cachedServerEnv;
  }

  const result = serverEnvSchema.safeParse(process.env);

  if (!result.success) {
    throw new Error(
      `Server environment variables are invalid:\n${formatZodError(result.error)}`
    );
  }

  cachedServerEnv = result.data;
  return cachedServerEnv;
}

export function getSupabaseEnv() {
  const publicEnv = getPublicEnv();

  return {
    supabaseUrl: publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
  };
}
