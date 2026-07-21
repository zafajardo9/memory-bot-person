---
name: project-planning
description: Converts a specification into a phased, dependency-ordered implementation plan. Use after specification is complete and before execution begins.
---

# Project Planning

When the user provides a task, feature request, or implementation goal, do not start coding immediately. Instead, create a detailed, systematic plan document under `plans/`. This skill ensures every implementation is preceded by thorough documentation, a checklist, and a step-by-step execution guide.

## When to Use This Skill

Activate this skill when the user:

- Describes a new feature to build
- Requests a significant refactor or architecture change
- Asks for a "plan" or "planning document"
- Provides a specification and wants an implementation roadmap
- Uses phrases like "plan this out", "create a plan for", "how should we build", "document the approach"

Do NOT use this skill for trivial single-file changes, quick bug fixes, or small edits.

## Workflow

### Step 1: Gather Requirements

Before writing the plan, ask the user clarifying questions when the task is ambiguous. At minimum, confirm:

- What is the **goal** in one sentence?
- What are the **must-have** deliverables vs nice-to-haves?
- Are there **technical constraints** (frameworks, dependencies, hosting)?
- What does **done** look like (acceptance criteria)?

### Step 2: Analyze the Codebase

Read relevant existing files to understand the current architecture. Identify:

- Files and directories that will be created, modified, or deleted
- Database models, migrations, or schema changes needed
- API routes, middleware, or server functions affected
- Frontend pages and components that need changes
- Shared utilities, types, or configuration that will be touched

### Step 3: Create the Plan Folder

Under `plans/`, create a folder named after the plan using lowercase, hyphenated format:

```
plans/<plan-name>/
```

Examples: `company-knowledge-base`, `user-onboarding-flow`, `api-rate-limiting`

### Step 4: Write the `PLAN.md` File

Inside the plan folder, create a `PLAN.md` file. Follow this exact structure:

#### Header

```markdown
# <Plan Title>

> **Status**: [ ] Planning | [ ] In Progress | [ ] Implemented | [ ] Archived
>
> **Created**: YYYY-MM-DD
>
> **Implemented**: YYYY-MM-DD (filled when complete)
>
> **Quick Checklist**:
> - [ ] Requirements gathered
> - [ ] Codebase analyzed
> - [ ] Database changes reviewed
> - [ ] Backend changes implemented
> - [ ] Frontend changes implemented
> - [ ] Tests passing
> - [ ] Security reviewed
> - [ ] Deployed
```

#### Section 1: Goal

A single, clear sentence describing the desired outcome.

#### Section 2: Context Summary

Two subsections:

- **Confirmed repository facts**: Bullet list of what you verified about the codebase (framework versions, existing patterns, database state, etc.)
- **Assumptions for this plan**: Bullet list of what you are assuming (will be validated during implementation)
- **Open decisions to resolve before implementation**: Bullet list of questions that need answers before coding starts

#### Section 3: Scope

A bullet list of everything that IS included in this plan.

#### Section 4: Out of Scope

A bullet list of everything explicitly NOT included (prevents scope creep).

#### Section 5: Affected Files and Folders

A tree diagram showing every file path that will be created (`+`), modified (`~`), or deleted (`-`):

```txt
app/
  (admin)/
    knowledge/
+     page.tsx
+     new/page.tsx
~ (chat)/
    api/
      chat/route.ts
    ...
db/
+   knowledge-queries.ts
```

Followed by **Important path notes** that explain why each key file needs changes.

#### Section 6: Step-by-Step Implementation Plan

Numbered, dependency-ordered steps. Each step must include:

- **What to do**: Concrete actions
- **Why**: Rationale
- **Affected files**: Exact paths
- **Dependencies**: Which previous steps must be complete

Steps must be ordered so each one only depends on earlier steps.

#### Section 7: Database Changes

If applicable. Describe:

- New models/tables with key fields
- Schema modifications (new columns, indexes, constraints)
- Migration strategy
- Seed data requirements

#### Section 8: Backend Changes

If applicable. List API routes, server functions, middleware, background jobs, and utilities with descriptions.

#### Section 9: Frontend Changes

If applicable. List pages, components, hooks, and state management with descriptions.

#### Section 10: Validation Rules

Input validation, error handling, and edge cases to cover.

#### Section 11: Security Considerations

Authentication, authorization, data protection, and threat mitigations.

#### Section 12: Testing Plan

- Unit tests
- Integration tests
- E2E tests
- Manual QA checklist

#### Section 13: Rollback Plan

How to reverse the changes if something goes wrong. Include database rollback strategy.

#### Section 14: Final Checklist

A markdown checklist summarizing all major phases. This mirrors the header checklist but in more detail.

### Step 5: Report Back

After creating the plan, summarize:

1. The plan folder and file path
2. The number of implementation steps
3. Any open decisions that need the user's input
4. The suggested order for starting implementation

## Plan File Conventions

- Use `PLAN.md` (uppercase) for the plan file name (matching existing convention in this repo).
- Folder names: lowercase, hyphenated, concise (3-5 words max).
- Dates in `YYYY-MM-DD` format.
- Always include the header status block at the top.
- Be specific with file paths — never use vague references like "somewhere in components/".
- Every step must have a clear "done" condition.
- Prefer additive changes over destructive ones. Mark files for creation, not deletion, unless explicitly requested.
- Do NOT write implementation code in the plan. The plan describes what to build, not how to build it line-by-line.

## Example Interaction

**User**: "I need to add a user profile page with avatar upload and bio editing."

**Agent** (activating this skill):

1. Asks clarifying questions: "Should avatars use the existing Vercel Blob storage? Should the profile be public or only visible to the user? Any specific bio length limits?"
2. Reads existing user model, auth setup, and component structure.
3. Creates `plans/user-profile-page/PLAN.md` with all 14 sections filled out.
4. Reports back with the plan path, step count, and open decisions.
