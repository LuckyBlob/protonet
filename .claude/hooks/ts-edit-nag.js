// PostToolUse(Edit|Write) nag: when a .ts/.tsx change leaves uncommitted ADDED comment lines or
// ADDED function/helper definitions, surface a reminder back to the model so it reconsiders whether
// the comment is necessary (default is zero comments) and whether an existing helper already exists.
// Non-blocking: always exits 0, only injects additionalContext when something is worth flagging.
const { execSync } = require("child_process");

let input = "";
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", () =>
{
    let filePath;
    try
    {
        filePath = JSON.parse(input).tool_input.file_path;
    }
    catch
    {
        process.exit(0);
    }

    if (typeof filePath !== "string" || /\.(ts|tsx)$/.test(filePath) === false)
    {
        process.exit(0);
    }

    const normalizedPath = filePath.replace(/\\/g, "/");

    let diff = "";
    try
    {
        diff = execSync(`git diff -U0 HEAD -- "${normalizedPath}"`, { encoding: "utf8" });
    }
    catch
    {
        process.exit(0);
    }

    if (diff.length === 0)
    {
        process.exit(0);
    }

    let addedCommentCount = 0;
    let addedDefinitionCount = 0;
    for (const line of diff.split("\n"))
    {
        if (line.startsWith("+") === false || line.startsWith("+++") === true)
        {
            continue;
        }

        const body = line.slice(1).trim();
        if (body.startsWith("//") || body.startsWith("/*") || body.startsWith("*"))
        {
            addedCommentCount += 1;
        }
        if (/^(export\s+)?function\s/.test(body) || /^(export\s+)?const\s+\w+\s*[:=].*=>/.test(body))
        {
            addedDefinitionCount += 1;
        }
    }

    const parts = [];
    if (addedCommentCount > 0)
    {
        parts.push(`+${addedCommentCount} comment line(s) — default is zero comments; keep only a non-obvious WHY, drop any WHAT`);
    }
    if (addedDefinitionCount > 0)
    {
        parts.push(`+${addedDefinitionCount} function/helper definition(s) — grep for an existing helper before keeping a new one`);
    }

    if (parts.length === 0)
    {
        process.exit(0);
    }

    const fileName = normalizedPath.split("/").pop();
    const message = `Self-check on ${fileName} (uncommitted): ${parts.join("; ")}.`;
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: message } }));
    process.exit(0);
});
