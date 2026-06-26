import { describe, it } from "vitest";
import { execFileSync } from "child_process";

// Why this test exists:
// The deploy's Type Check gate runs `tsc --noEmit` over the WHOLE project (source + tests). Nothing else in
// the local suite does: vitest strips types at runtime, and `next build` only type-checks the app module
// graph (not tests/). So a type error in a test — or anything that would fail the deploy's tsc gate, e.g. a
// renamed/removed API route — used to surface only at deploy time. This runs the same check so the local
// suite fails first, before submit.
//
// It uses tsconfig.typecheck.json (excludes the generated .next/types), so it is deterministic regardless of
// the .next build cache and never trips the stale-validator false positive that broke the ship->unit deploy.
describe("project type check", (): void =>
{
    it("passes tsc --noEmit over the whole project (source + tests)", (): void =>
    {
        try
        {
            execFileSync("pnpm", ["exec", "tsc", "--noEmit", "-p", "tsconfig.typecheck.json"],
            {
                cwd: process.cwd(),
                stdio: "pipe",
                shell: true,
            });
        }
        catch (error: unknown)
        {
            const execError: { stdout?: Buffer; stderr?: Buffer } = error as { stdout?: Buffer; stderr?: Buffer };
            const tscOutput: string = `${execError.stdout?.toString() ?? ""}${execError.stderr?.toString() ?? ""}`;
            throw new Error(`tsc --noEmit reported type errors (run \`pnpm typecheck\` to reproduce):\n${tscOutput}`);
        }
    }, 180000);
});
