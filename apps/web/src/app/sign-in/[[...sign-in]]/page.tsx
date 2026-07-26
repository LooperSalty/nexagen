import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "Connexion — NEXAGEN",
  description: "Connectez-vous pour créer et explorer vos mondes NEXAGEN.",
};

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-dark px-6 py-12">
      <div className="flex flex-col items-center gap-8">
        <span className="text-2xl font-bold font-display gradient-text">
          NEXAGEN
        </span>
        <SignIn />
      </div>
    </div>
  );
}
