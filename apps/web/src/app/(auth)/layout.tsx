import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <nav className="sticky top-0 z-50 border-b border-glass-medium bg-bg-primary/80 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <span className="text-lg font-bold font-display gradient-text">
            NEXAGEN
          </span>
          <div className="flex items-center gap-6">
            <a
              href="/explore"
              className="text-sm text-text-secondary transition-colors hover:text-text-primary"
            >
              Explorer
            </a>
            <a
              href="/studio"
              className="text-sm text-text-secondary transition-colors hover:text-text-primary"
            >
              Studio
            </a>
          </div>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  );
}
