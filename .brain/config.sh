# Per-project .brain/ configuration
# Sourced by every script in .brain/scripts/.

# Project identity
PROJECT_SLUG="flowclock-cli"
PROJECT_NAME="FlowClock CLI"

# CKIS vault paths (absolute — adjust per machine if vault relocates)
CKIS_VAULT="$HOME/Documents/Second Brain"
CKIS_MEMORY="$CKIS_VAULT/00-inbox/_MEMORY.md"
CKIS_PROJECT_OVERVIEW="$CKIS_VAULT/02-projects/$PROJECT_SLUG/_overview.md"
CKIS_ARCHITECTURE_NOTE="$CKIS_VAULT/03-knowledge/permanent-notes/per-project-second-brain.md"

# Brain paths (relative to repo root)
BRAIN_DIR=".brain"
SESSIONS_DIR="$BRAIN_DIR/sessions"
DECISIONS_DIR="$BRAIN_DIR/decisions"
BUGS_DIR="$BRAIN_DIR/bugs"
GRAPH_DIR="$BRAIN_DIR/graph"
CONTEXT_FILE="$BRAIN_DIR/_CONTEXT.md"
SESSION_STATE="$BRAIN_DIR/.session-state"

# How many recent session summaries to inline in _CONTEXT.md
RECENT_SESSIONS_LIMIT=3

# Dev Brain vault (Obsidian — code graph + wiki layer, separate from CKIS)
DEV_BRAIN_VAULT="$HOME/Documents/Dev Brain"
# Rebuild --obsidian vault every N commits (expensive: one .md per node)
OBSIDIAN_GRAPH_CADENCE=10
