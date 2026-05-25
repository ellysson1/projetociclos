#!/bin/bash
# Auto-increment ?v= cache-busting params in index.html after git commit
INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

# Only act on git commit (skip --amend to avoid loop)
echo "$CMD" | grep -qE 'git commit' || exit 0
echo "$CMD" | grep -q -- '--amend' && exit 0

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
INDEX="$REPO_ROOT/index.html"
[ -f "$INDEX" ] || exit 0

# Get files changed in last commit
CHANGED=$(git diff --name-only HEAD~1 HEAD 2>/dev/null)
[ -z "$CHANGED" ] && exit 0

BUMPED=false
while IFS= read -r file; do
    echo "$file" | grep -qE '\.(js|css)$' || continue
    CURRENT_V=$(perl -sne 'print $1 if /\Q$f\E\?v=(\d+)/' -- -f="$file" "$INDEX")
    [ -z "$CURRENT_V" ] && continue
    NEW_V=$((CURRENT_V + 1))
    perl -i -spe 's|\Q$f\E\?v=\d+|$f?v=$v|g' -- -f="$file" -v="$NEW_V" "$INDEX"
    BUMPED=true
done <<< "$CHANGED"

if [ "$BUMPED" = true ]; then
    cd "$REPO_ROOT" || exit 0
    git add index.html
    git commit --amend --no-edit 2>/dev/null
    echo '{"systemMessage":"Cache-bust automático: versões ?v= atualizadas no index.html."}'
fi
