# Replace this text with the prompt name (use kebab-case for the filename)

## Purpose
<purpose>
Replace this text with one sentence describing what this prompt makes Claude do and why it exists.
</purpose>

## Verbosity
<verbosity>
Replace this text with either "simple" or "detailed".

simple   → Minimum viable structure. Prefer short, direct output. Skip sections that add no signal.
detailed → Use all sections. Be explicit about reasoning, edge cases, and output format. Prefer completeness over brevity.
</verbosity>

## Triggers
<!-- The dependency manifest for this prompt. Machine-readable.
     A future MCP loader uses this section to auto-attach tools, invoke skills,
     and pull file context before handing off to Claude.
     Leave a section empty if unused — do not remove the tags. -->

### Tools
<tools>
Replace this text with the MCP or Claude tools this prompt needs at runtime, one per line.
Example:
  - read_file
  - list_directory
  - web_search
</tools>

### Skills
<skills>
Replace this text with any skills in this repo that this prompt orchestrates or depends on, one per line.
Example:
  - idea-capture
  - generate-prd
</skills>

### Files
<files>
Replace this text with file paths that should be loaded into context before this prompt runs.
Use paths relative to the repo root or $HOME/dotfiles.
Example:
  - STYLE_GUIDE.md
  - eslint/eslint.base.js
  - package.json
</files>

## Context
<context>
Replace this text with the written briefing Claude needs before executing instructions.
Describe the situation, background, or assumptions — not what to do, just what to know.
</context>

## Instructions
<instructions>
Replace this text with the core behavior specification, written against both verbosity modes.
- **simple**:
- **detailed**:
</instructions>

## Constraints
<constraints>
Replace this text with hard boundaries — what Claude must never do in this mode regardless of input.
Focus on failure modes specific to this prompt, not generic rules.
</constraints>

## Output Format
<output_format>
Replace this text with an exact description of what the response should look like.
Specify structure (markdown, JSON, prose), length, tone, and any required sections.
</output_format>

## Example
<!-- Optional but recommended for complex prompts.
     One representative input/output pair showing the happy path. -->

### Input
<example_input>
Replace this text with a representative input for this prompt.
</example_input>

### Output
<example_output>
Replace this text with the expected output for the input above.
</example_output>
