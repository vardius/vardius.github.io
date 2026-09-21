#!/usr/bin/env bash
# Writes the JSON snapshot the site renders from:
#
#   data/repos.json   – every public repository owned by $OWNER (trimmed fields)
#                       plus private repositories that opted in to the showcase:
#                       GitHub Pages enabled AND tagged with the $SHOWCASE_TOPIC
#                       topic. Private entries carry only name, description and
#                       language with "private": true — no URLs into the repository.
#   data/profile.json – login, name, bio, profile URL. Nothing else.
#
# Needs the GitHub CLI (`gh`) and `jq`. Public data works with any token,
# including the workflow's GITHUB_TOKEN. Private showcase repositories need a
# token that can read their metadata (see .github/workflows/deploy.yml).
#
# Usage: OWNER=vardius ./scripts/fetch-data.sh
set -euo pipefail

OWNER="${OWNER:-vardius}"
OUT="${OUT:-data}"
SHOWCASE_TOPIC="${SHOWCASE_TOPIC:-showcase}"
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$OUT"

echo "Fetching public repositories for @$OWNER…"
gh api --paginate "users/$OWNER/repos?per_page=100&type=owner" \
  | jq -s '(add // []) | map({
      name, description, html_url, homepage,
      stargazers_count, forks_count, open_issues_count,
      language, topics, fork, archived, is_template, has_pages,
      created_at, pushed_at,
      license: (.license.spdx_id // null),
      private: false
    })' > "$TMP/public.json"

echo "Looking for private repositories tagged '$SHOWCASE_TOPIC' with GitHub Pages…"
# The workflow's default GITHUB_TOKEN cannot list a user's private repositories;
# in that case we simply end up with none.
if gh api --paginate "user/repos?visibility=private&affiliation=owner&per_page=100" > "$TMP/private.raw.json" 2>/dev/null; then
  jq -s --arg topic "$SHOWCASE_TOPIC" '(add // [])
    | map(select(.has_pages and ((.topics | index($topic)) != null)))
    | map({ name, description, language, pushed_at, topics: [], has_pages: true, private: true })' \
    "$TMP/private.raw.json" > "$TMP/private.json"
else
  echo "  (this token cannot read private repositories; skipping)"
  echo '[]' > "$TMP/private.json"
fi

jq -n --arg now "$NOW" --arg owner "$OWNER" \
  --slurpfile pub "$TMP/public.json" --slurpfile priv "$TMP/private.json" \
  '{ generated_at: $now, owner: $owner, repos: ($pub[0] + $priv[0]) }' > "$OUT/repos.json"

echo "Resolving GitHub Pages URLs (custom domains)…"
# Best effort: needs "Pages: Read" on the repository. Without it the site falls
# back to https://$OWNER.github.io/<repo>/, which GitHub redirects anyway.
: > "$TMP/pages.tsv"
while IFS= read -r name; do
  url="$(gh api "repos/$OWNER/$name/pages" --jq '.html_url // empty' 2>/dev/null || true)"
  if [ -n "$url" ]; then printf '%s\t%s\n' "$name" "$url" >> "$TMP/pages.tsv"; fi
done < <(jq -r '.repos[] | select(.has_pages) | .name' "$OUT/repos.json")
jq -R -s 'split("\n") | map(select(length > 0) | split("\t") | {key: .[0], value: .[1]}) | from_entries' \
  "$TMP/pages.tsv" > "$TMP/pages.json"
jq --slurpfile pages "$TMP/pages.json" \
  '.repos |= map(. + { pages_url: (if .has_pages then ($pages[0][.name] // null) else null end) })' \
  "$OUT/repos.json" > "$TMP/final.json"
mv "$TMP/final.json" "$OUT/repos.json"
echo "  resolved $(jq 'length' "$TMP/pages.json") of $(jq '[.repos[] | select(.has_pages)] | length' "$OUT/repos.json") Pages URLs"

echo "Fetching profile…"
# Deliberately limited: location, company, e-mail and social handles are not copied.
gh api "users/$OWNER" \
  | jq '{login, name, bio, html_url}' > "$OUT/profile.json"

echo "Wrote $(jq '[.repos[] | select(.private | not)] | length' "$OUT/repos.json") public repositories" \
     "and $(jq '[.repos[] | select(.private)] | length' "$OUT/repos.json") private showcase sites to $OUT/"
