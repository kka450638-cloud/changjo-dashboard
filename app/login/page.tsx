import AdminLoginForm from "./admin-login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const sp = await searchParams;
  let redirectTo = sp.from?.trim() || "/";
  if (!redirectTo.startsWith("/") || redirectTo.startsWith("//")) {
    redirectTo = "/";
  }
  if (redirectTo === "/login") {
    redirectTo = "/";
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-zinc-100 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-center text-xl font-bold text-amber-600 dark:text-amber-400">
          창조 지점 관리
        </h1>
        <p className="mt-1 text-center text-sm text-zinc-500 dark:text-zinc-400">
          관리자 번호를 입력해 주세요.
        </p>
        <div className="mt-8">
          <AdminLoginForm redirectTo={redirectTo} />
        </div>
      </div>
    </div>
  );
}
