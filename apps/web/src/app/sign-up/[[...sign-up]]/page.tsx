import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "Inscription — NEXAGEN",
  description: "Créez votre compte NEXAGEN et générez votre premier monde.",
};

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-dark px-6 py-12">
      <div className="flex flex-col items-center gap-8">
        <span className="text-2xl font-bold font-display gradient-text">
          NEXAGEN
        </span>
        <SignUp />
      </div>
    </div>
  );
}
