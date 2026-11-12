# Pull request format

Every pull request that adds or changes `submissions/<task-id>/` must follow one of two templates. The **Submission format** workflow (`spu/pr-format` status) checks the title, description and files on every edit and push. It keeps one **Automated checks** comment on the PR, updated in place, that lists each check below with its result, the AI review status and what happens next.

## Titles

| PR | Title | Example |
|---|---|---|
| New task | `[Task] <task-id>: <scientific title>` | `[Task] organoboron-fluorescence-yield: Ranking absolute fluorescence quantum yields of eight organoboron dyes` |
| Fix to an existing task | `[Fix] <task-id>: <what this corrects>` | `[Fix] amine-borane-arylation-bases: Correct the yield unit for group 3` |

- `<task-id>` is the folder name under `submissions/`: lowercase letters, digits, `-` or `_`.
- Up to three related tasks may share one PR: `[Task] task-a, task-b: <title>`.
- A PR counts as a fix when the task folder already exists on `main`. New tasks and fixes go in separate PRs.
- PRs that do not touch `submissions/` (docs, code) are outside these rules.

## Descriptions

The default template is for new tasks. For a fix, add `?template=fix.md` to the compare URL, e.g. `https://github.com/UniPat-AI/SPU/compare/main...<branch>?template=fix.md`.

**New task**: Task ID, discipline (Chemistry, Materials science, Biology, Medicine or Other), subfield, scientific question, prediction target and ranking direction, number of candidates and groups. Then the data source: type, title/owner/version, DOI or URL, license or permission covering every file, raw versus referenced data, restrictions. All completeness items, the public-release confirmation and the automated AI processing authorization must be ticked.

**Fix**: Task ID, what is wrong, what the PR changes, evidence, effect on reference rankings, and the two confirmations.

Placeholders such as `<task-id>` count as empty. Without the automated AI processing authorization, no automated review runs (`spu/clarity-audit` stays pending).

## Automated checks

Each heading below is one row of the Automated checks comment. Task PRs run all checks except the fix description; fix PRs run scope, title, task ID, fix description and confirmations.

### Scope

The PR changes only `submissions/<task-id>/` folders. New tasks and fixes to existing tasks go in separate PRs, and changes outside `submissions/` (docs, code) go in another PR.

### Title

`[Task] <task-id>: <scientific title>` or `[Fix] <task-id>: <what this corrects>`, matching the folder names, with at least 15 characters after the colon and under 150 characters in total.

### Task ID

The description's `Task ID` lists the same task folders as the PR.

### Files

Each new task folder has `task-plan.md` and `reference-rankings.xlsx`, or a single `submission.zip` with both at its root, not both forms. Supporting data goes in `data/`. Task IDs are at most 80 characters.

### Task description

Discipline is one of Chemistry, Materials science, Biology, Medicine or Other (a short note may follow, e.g. `Chemistry (organic)`), and subfield, scientific question, prediction target and ranking direction, and candidates and groups are filled in.

### Fix description

What is wrong, what the PR changes, the evidence, and the effect on reference rankings are filled in.

### Data source and license

Source type starts with public dataset, published research, own open data or mixed (a note may follow, e.g. `own open data (synthetic)`). Source title and owner, DOI or URL, the license or permission for every file (name and link, e.g. `CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)`) and raw versus referenced data are filled in.

### Completeness checklist

All six completeness items are ticked.

### Confirmations

The public-release confirmation and the automated AI processing authorization are ticked. Without the authorization no AI review runs.

## What the checks mean

| Status | Meaning |
|---|---|
| `spu/pr-format` | Title and description follow the template. It says nothing about the scientific content. |
| `spu/clarity-audit` | Server-side AI review of the plan and data for this exact commit and description. Completeness only, not scientific validation. |
