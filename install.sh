#!/usr/bin/env bash
# Link the skills in this repo into your agent's skill folder.
#
# Unlike `npx skills add`, this makes a symlink instead of a copy, so a
# `git pull` in this repo updates the installed skill in place.
#
#   ./install.sh               # link into Claude Code   (~/.claude/skills)
#   ./install.sh --codex       # link into Codex         (~/.codex/skills)
#   ./install.sh --all-agents  # both
#   ./install.sh --project     # link into ./.claude/skills of the current folder
#   ./install.sh --list        # show what would be linked
#   ./install.sh --uninstall   # remove links that point into this repo
#
# Needs bash only.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_DIR="$REPO/skills"
targets=()
mode=install

while [[ $# -gt 0 ]]; do
  case "$1" in
    --claude)     targets+=("$HOME/.claude/skills") ;;
    --codex)      targets+=("$HOME/.codex/skills") ;;
    --all-agents) targets+=("$HOME/.claude/skills" "$HOME/.codex/skills") ;;
    --project)    targets+=("$PWD/.claude/skills") ;;
    --list)       mode=list ;;
    --uninstall)  mode=uninstall ;;
    -h|--help)    sed -n '2,13p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *)            echo "unknown option: $1 (see --help)" >&2; exit 2 ;;
  esac
  shift
done
[[ ${#targets[@]} -eq 0 ]] && targets=("$HOME/.claude/skills")

# name from SKILL.md frontmatter, folder name as fallback
skill_name() {
  local n
  n="$(awk 'NR==1 && $0!="---"{exit} NR>1 && /^---/{exit} NR>1 && /^name:/{sub(/^name:[ \t]*/,""); print; exit}' "$1/SKILL.md")"
  echo "${n:-$(basename "$1")}"
}

for skill in "$SKILLS_DIR"/*/; do
  skill="${skill%/}"
  [[ -f "$skill/SKILL.md" ]] || continue
  name="$(skill_name "$skill")"
  for dir in "${targets[@]}"; do
    dest="$dir/$name"
    case "$mode" in
      list)
        echo "$name  ->  $dest" ;;
      uninstall)
        if [[ -L "$dest" && "$(readlink "$dest")" == "$skill" ]]; then
          rm "$dest" && echo "removed $dest"
        fi ;;
      install)
        mkdir -p "$dir"
        if [[ -L "$dest" ]]; then
          rm "$dest"
        elif [[ -e "$dest" ]]; then
          echo "skip $dest: a folder that is not a link already exists there (remove it first)" >&2
          continue
        fi
        ln -s "$skill" "$dest"
        echo "linked $name -> $dest" ;;
    esac
  done
done
