#!/usr/bin/env node
// PreToolUse guard: the user does not want Claude taking over the desktop (mouse/keyboard via
// computer-use) to launch Chrome. This hook hard-denies any computer-use open_application call that
// targets Google Chrome, with a reason telling Claude to ASK the user to open Chrome instead and
// then read pages through the Claude-in-Chrome extension. Opening any other app, and every other
// computer-use action, passes through untouched.

let input = "";
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", () =>
{
    let app = "";
    try
    {
        const payload = JSON.parse(input || "{}");
        app = (payload.tool_input && payload.tool_input.app) || "";
    }
    catch (error)
    {
        process.exit(0); // unparseable payload -> don't block
    }

    if (targetsChrome(app) === true)
    {
        process.stdout.write(JSON.stringify({
            hookSpecificOutput: {
                hookEventName: "PreToolUse",
                permissionDecision: "deny",
                permissionDecisionReason: "Do not launch Chrome by controlling the desktop (block-chrome-open hook). Ask the user to open Chrome themselves, then read pages through the Claude-in-Chrome extension (mcp__Claude_in_Chrome__*)."
            }
        }));
    }

    process.exit(0);
});

function targetsChrome(app)
{
    if (typeof app !== "string" || app.length === 0)
    {
        return false;
    }

    return app.toLowerCase().includes("chrome");
}
