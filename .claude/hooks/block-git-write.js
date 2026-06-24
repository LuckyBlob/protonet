#!/usr/bin/env node
// PreToolUse guard: force a confirmation prompt on any `git commit` / `git push` (including
// force-push and occurrences inside compound commands like `cd x && git push`). A hook can't read
// whether the user asked in chat, so instead of silently allowing or hard-denying, it ALWAYS asks:
// the user approves when they requested it, and denies an unexpected (unprompted) one. Everything
// else passes through untouched.

let input = "";
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", () =>
{
    let command = "";
    try
    {
        const payload = JSON.parse(input || "{}");
        command = (payload.tool_input && payload.tool_input.command) || "";
    }
    catch (error)
    {
        process.exit(0); // unparseable payload -> don't block
    }

    if (isGitWriteCommand(command) === true)
    {
        process.stdout.write(JSON.stringify({
            hookSpecificOutput: {
                hookEventName: "PreToolUse",
                permissionDecision: "ask",
                permissionDecisionReason: "git commit/push requires your explicit confirmation (block-git-write hook): approve if you asked for it, deny if this was unprompted."
            }
        }));
    }

    process.exit(0);
});

function isGitWriteCommand(command)
{
    if (typeof command !== "string" || command.length === 0)
    {
        return false;
    }

    const segments = command.split(/&&|\|\||[;\n|]/);
    for (const segment of segments)
    {
        const tokens = segment.trim().split(/\s+/).filter((token) => token.length > 0).map(stripQuotes);
        const gitIndex = tokens.findIndex((token) => token === "git" || token === "git.exe" || token.endsWith("/git") || token.endsWith("\\git.exe"));
        if (gitIndex === -1)
        {
            continue;
        }

        for (let i = gitIndex + 1; i < tokens.length; i++)
        {
            const subcommand = tokens[i].toLowerCase();
            if (subcommand === "commit" || subcommand === "push")
            {
                return true;
            }
        }
    }

    return false;
}

function stripQuotes(token)
{
    return token.replace(/^['"]+/, "").replace(/['"]+$/, "");
}
