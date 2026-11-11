# Pull request format

Every pull request that adds or changes `submissions/<task-id>/` must follow one of two templates. The **Submission format** workflow (`spu/pr-format` status) checks the title and description on every edit. When something needs a change, it posts one comment listing what to fix and updates that comment until the PR follows the format.

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

## What the checks mean

| Status | Meaning |
|---|---|
| `spu/pr-format` | Title and description follow the template. It says nothing about the scientific content. |
| `spu/clarity-audit` | Server-side AI review of the plan and data for this exact commit and description. Completeness only, not scientific validation. |
