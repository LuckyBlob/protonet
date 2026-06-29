// PostToolUse(Edit|Write) guard for .ts/.tsx changes.
//
// Comments are BLOCKING: if an edit adds net-new comment line(s), the hook exits 2 so the change is
// rejected back to the model, which must remove them before doing anything else. The default is ZERO
// comments (intent goes in names, not prose); soft reminders were ignored 10+ times, so this is a wall.
// It is edit-local (this edit's old_string -> new_string), so a comment that is consciously kept will
// not re-fire on later edits to the same file.
//
// Added function/helper definitions stay a NON-blocking nag (sometimes a new helper is correct).
const { execSync } = require("child_process");

function countCommentLines(text)
{
    if (typeof text !== "string")
    {
        return 0;
    }

    let count = 0;
    for (const rawLine of text.split("\n"))
    {
        const body = rawLine.trim();
        if (body.startsWith("//") || body.startsWith("/*") || body.startsWith("*"))
        {
            count += 1;
        }
    }
    return count;
}

let input = "";
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", () =>
{
    let payload;
    try
    {
        payload = JSON.parse(input);
    }
    catch
    {
        process.exit(0);
    }

    const toolName = payload.tool_name;
    const toolInput = payload.tool_input || {};
    const filePath = toolInput.file_path;

    if (typeof filePath !== "string" || /\.(ts|tsx)$/.test(filePath) === false)
    {
        process.exit(0);
    }

    const fileName = filePath.replace(/\\/g, "/").split("/").pop();

    // Edit-local comment delta: only the lines this specific edit introduced count, so a comment that
    // is deliberately kept is not re-flagged on the next edit to the same file.
    let addedCommentCount = 0;
    if (toolName === "Edit")
    {
        addedCommentCount = countCommentLines(toolInput.new_string) - countCommentLines(toolInput.old_string);
    }
    else if (toolName === "Write")
    {
        let previousContent = "";
        try
        {
            const normalizedPath = filePath.replace(/\\/g, "/");
            previousContent = execSync(`git show "HEAD:./${normalizedPath}"`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
        }
        catch
        {
            previousContent = "";
        }
        addedCommentCount = countCommentLines(toolInput.content) - countCommentLines(previousContent);
    }

    if (addedCommentCount > 0)
    {
        const message =
            `BLOCKED: this edit added ${addedCommentCount} comment line(s) to ${fileName}.\n` +
            `The rule is ZERO comments by default — express intent through names, not prose.\n` +
            `Re-do the edit with those comment lines deleted. Keep a comment ONLY if it is a genuine\n` +
            `non-obvious WHY / ordering note, or a required boundary comment (e.g. the "!=" network-\n` +
            `boundary comment) that cannot be encoded in a name — at most that one. If you keep one after\n` +
            `honest review, that is a deliberate choice and you may proceed; this block exists to force the\n` +
            `review every time. See memory feedback_comments_only_why.`;
        process.stderr.write(message);
        process.exit(2);
    }

    // Definitions remain advisory only.
    let addedDefinitionCount = 0;
    let diff = "";
    try
    {
        const normalizedPath = filePath.replace(/\\/g, "/");
        diff = execSync(`git diff -U0 HEAD -- "${normalizedPath}"`, { encoding: "utf8" });
    }
    catch
    {
        process.exit(0);
    }

    for (const line of diff.split("\n"))
    {
        if (line.startsWith("+") === false || line.startsWith("+++") === true)
        {
            continue;
        }

        const body = line.slice(1).trim();
        if (/^(export\s+)?function\s/.test(body) || /^(export\s+)?const\s+\w+\s*[:=].*=>/.test(body))
        {
            addedDefinitionCount += 1;
        }
    }

    if (addedDefinitionCount === 0)
    {
        process.exit(0);
    }

    const message = `Self-check on ${fileName} (uncommitted): +${addedDefinitionCount} function/helper definition(s) — grep for an existing helper before keeping a new one.`;
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: message } }));
    process.exit(0);
});
