"use client";

import { useState, useCallback } from "react";

type GenerationStatus = "idle" | "generating" | "complete" | "error";

interface GenerationState {
  readonly status: GenerationStatus;
  readonly progress: number;
  readonly message: string;
}

const INITIAL_STATE: GenerationState = {
  status: "idle",
  progress: 0,
  message: "",
};

export default function StudioPage() {
  const [prompt, setPrompt] = useState("");
  const [generation, setGeneration] = useState<GenerationState>(INITIAL_STATE);

  const handleGenerate = useCallback(async () => {
    const trimmed = prompt.trim();
    if (trimmed.length === 0) {
      return;
    }

    setGeneration({ status: "generating", progress: 0, message: "Analyse du prompt..." });

    try {
      const steps = [
        { progress: 20, message: "Analyse du prompt...", delay: 800 },
        { progress: 40, message: "Generation du terrain...", delay: 1200 },
        { progress: 60, message: "Placement des structures...", delay: 1000 },
        { progress: 80, message: "Application des textures...", delay: 900 },
        { progress: 100, message: "Finalisation du monde...", delay: 600 },
      ];

      for (const step of steps) {
        await new Promise<void>((resolve) => setTimeout(resolve, step.delay));
        setGeneration({
          status: "generating",
          progress: step.progress,
          message: step.message,
        });
      }

      setGeneration({ status: "complete", progress: 100, message: "Monde genere avec succes !" });
    } catch {
      setGeneration({
        status: "error",
        progress: 0,
        message: "Une erreur est survenue lors de la generation.",
      });
    }
  }, [prompt]);

  const handleReset = useCallback(() => {
    setPrompt("");
    setGeneration(INITIAL_STATE);
  }, []);

  const isGenerating = generation.status === "generating";

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-10">
        <h1 className="text-3xl font-bold font-display md:text-4xl">Studio</h1>
        <p className="mt-2 text-text-secondary">
          Decrivez le monde que vous souhaitez creer et laissez l&apos;IA faire le reste.
        </p>
      </header>

      {/* Prompt input */}
      <div className="mb-8">
        <label htmlFor="world-prompt" className="mb-2 block text-sm font-medium text-text-secondary">
          Votre description
        </label>
        <textarea
          id="world-prompt"
          rows={5}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={isGenerating}
          placeholder="Ex: Une ile flottante avec des cascades de lave, des arbres cristallins et un temple ancien au sommet..."
          className="w-full resize-none rounded-lg border border-glass-medium bg-bg-secondary p-4 text-text-primary placeholder:text-text-tertiary outline-none transition-colors focus:border-accent-primary disabled:opacity-50"
        />
        <p className="mt-1 text-xs text-text-tertiary">
          {prompt.length} / 500 caracteres
        </p>
      </div>

      {/* Action buttons */}
      <div className="mb-10 flex gap-4">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating || prompt.trim().length === 0}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:transform-none"
        >
          {isGenerating ? "Generation en cours..." : "Generer"}
        </button>

        {generation.status !== "idle" && (
          <button
            type="button"
            onClick={handleReset}
            disabled={isGenerating}
            className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reinitialiser
          </button>
        )}
      </div>

      {/* Generation progress */}
      {generation.status !== "idle" && (
        <div className="glass-panel p-6">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-medium text-text-secondary">
              {generation.message}
            </span>
            <span className="text-sm font-mono text-accent-primary">
              {generation.progress}%
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-bg-tertiary">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${generation.progress}%`,
                background: generation.status === "error"
                  ? "var(--error)"
                  : "var(--gradient-primary)",
              }}
            />
          </div>

          {/* Status messages */}
          {generation.status === "complete" && (
            <div className="mt-4 flex items-center gap-2 text-sm" style={{ color: "var(--success)" }}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-5 w-5"
              >
                <path
                  fillRule="evenodd"
                  d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{generation.message}</span>
            </div>
          )}

          {generation.status === "error" && (
            <div className="mt-4 flex items-center gap-2 text-sm" style={{ color: "var(--error)" }}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-5 w-5"
              >
                <path
                  fillRule="evenodd"
                  d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-1.72 6.97a.75.75 0 1 0-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06L12 13.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L13.06 12l1.72-1.72a.75.75 0 1 0-1.06-1.06L12 10.94l-1.72-1.72Z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{generation.message}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
