"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const fadeInUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.15, duration: 0.5, ease: "easeOut" },
  }),
};

const features = [
  {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="w-8 h-8"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"
        />
      </svg>
    ),
    title: "Generation IA",
    description:
      "Decrivez votre monde en langage naturel. Notre IA genere un environnement voxel 3D unique en quelques secondes.",
  },
  {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="w-8 h-8"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z"
        />
      </svg>
    ),
    title: "Jouable Instantanement",
    description:
      "Pas de telechargement, pas d'installation. Explorez votre monde directement dans le navigateur avec des controles FPS fluides.",
  },
  {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="w-8 h-8"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z"
        />
      </svg>
    ),
    title: "Partagez",
    description:
      "Partagez vos mondes avec la communaute. Explorez les creations des autres et remixez-les a l'infini.",
  },
] as const;

const steps = [
  { number: 1, title: "Decris", description: "Ecrivez une description de votre monde ideal en langage naturel." },
  { number: 2, title: "Genere", description: "L'IA transforme votre texte en un monde voxel 3D detaille." },
  { number: 3, title: "Joue", description: "Explorez votre monde en temps reel directement dans le navigateur." },
] as const;

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        className="pointer-events-none fixed inset-0"
        style={{ background: "var(--gradient-radial)" }}
      />

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center px-6 pt-32 pb-24 text-center">
        <motion.h1
          className="max-w-4xl text-5xl font-bold leading-tight tracking-tight font-display md:text-7xl"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="gradient-text">Decris ton monde.</span>
          <br />
          <span className="text-text-primary">L&apos;IA le construit.</span>
          <br />
          <span className="text-text-primary">Tu y joues.</span>
        </motion.h1>

        <motion.p
          className="mt-6 max-w-2xl text-lg text-text-secondary md:text-xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          NEXAGEN transforme vos descriptions en mondes voxels 3D jouables instantanement dans le navigateur.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-10"
        >
          <Link
            href="/studio"
            className="btn-primary inline-block text-lg px-8 py-4 rounded-xl"
          >
            Generer mon premier monde
          </Link>
        </motion.div>
      </section>

      {/* Features */}
      <section className="relative px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <motion.h2
            className="mb-16 text-center text-3xl font-bold font-display md:text-4xl"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            custom={0}
          >
            Tout ce qu&apos;il faut pour creer
          </motion.h2>

          <div className="grid gap-8 md:grid-cols-3">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                className="glass-panel p-8 transition-colors hover:border-accent-primary/30"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={fadeInUp}
                custom={i + 1}
              >
                <div className="mb-4 inline-flex items-center justify-center rounded-lg bg-accent-primary/10 p-3 text-accent-primary">
                  {feature.icon}
                </div>
                <h3 className="mb-2 text-xl font-semibold font-display">
                  {feature.title}
                </h3>
                <p className="text-text-secondary leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="relative px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <motion.h2
            className="mb-16 text-center text-3xl font-bold font-display md:text-4xl"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            custom={0}
          >
            Comment ca marche
          </motion.h2>

          <div className="flex flex-col gap-12 md:flex-row md:gap-8">
            {steps.map((step, i) => (
              <motion.div
                key={step.number}
                className="flex flex-1 flex-col items-center text-center"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={fadeInUp}
                custom={i + 1}
              >
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-accent-primary to-accent-secondary text-xl font-bold text-white shadow-lg">
                  {step.number}
                </div>
                <h3 className="mb-2 text-xl font-semibold font-display">
                  {step.title}
                </h3>
                <p className="text-text-secondary leading-relaxed">
                  {step.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-glass-medium px-6 py-8">
        <div className="mx-auto max-w-6xl text-center text-sm text-text-tertiary">
          &copy; {new Date().getFullYear()} NEXAGEN. Tous droits reserves.
        </div>
      </footer>
    </div>
  );
}
