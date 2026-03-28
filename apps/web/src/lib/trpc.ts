import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { API_URL } from "./constants";

/**
 * Placeholder type for the app router.
 * Replace with the actual AppRouter type from @nexagen/shared
 * once the tRPC router is defined.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type AppRouter = Record<string, never>;

export const trpc = createTRPCReact<AppRouter>();

export function createTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${API_URL}/trpc`,
        headers() {
          return {
            "x-trpc-source": "nexagen-web",
          };
        },
      }),
    ],
  });
}

export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
