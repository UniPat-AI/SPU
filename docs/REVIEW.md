# How a task PR is reviewed

Every pull request that adds or changes `submissions/<task-id>/` is checked automatically. The checks report on completeness and clarity; maintainers decide on scientific acceptance.

## Review criteria

These are the criteria we use to select benchmark tasks. Automated review and maintainers apply them together.

1. **Complete experimental protocol.** Materials, conditions, procedure and measurement method are described clearly enough for a researcher in the field to understand how the experiment was done.
2. **Clear prediction target.** State the measured quantity, its unit, the ranking direction, and which candidates belong to each comparison group.
3. **Results that discriminate.** Differences between candidates in a group are clearly larger than the measurement error. Comparisons with very small differences, or whose order simply follows one varied parameter, do not make good tasks.
4. **Replicates or uncertainty.** Give the number of replicates and a standard deviation or interval. If these are not available, say so and explain why.
5. **Traceable, consistent data.** Every reference result can be located in the source data, and the plan, workbook and candidate IDs agree with each other.
6. **Answers kept apart from the task.** Nothing the model is given reveals or implies the measured results.
7. **Cleared for release.** All material may be redistributed under a public licence. Use the private workspace for unpublished or restricted data.

Passing review does not mean the scientific results have been validated; maintainers make the final decision on acceptance.

## Statuses

| Status | What it checks | Rerun |
| --- | --- | --- |
| `spu/pr-format` | Scope, title, task ID, files, description, data source, completeness and confirmations ([PR-FORMAT.md](PR-FORMAT.md#automated-checks)). One **Automated checks** comment on the PR shows each check, the AI review status and the next steps. | Every edit or push, and when the AI review finishes |
| `spu/clarity-audit` | Automated review of the task plan, workbook and data against the criteria above, run on the SPU server when GitHub notifies it of the PR. Results are posted as a PR comment by the SPU maintainers' account. | Every push, description edit or reopen |
| `check` | Engineering checks of this repository's own code. | Every push |

`spu/clarity-audit` states:

| State | Meaning |
| --- | --- |
| success | The delivered material is clear and internally consistent, or the PR has no submission files (not applicable). Not scientific validation or merge approval. |
| failure | Clarifications or corrections are requested (see the linked report), or the file layout needs a fix (the status says what). |
| pending | Waiting for the two checkboxes in the description, the PR is a draft or closed, or the review is running. |
| error | The review could not be completed. No passing result is implied; push again or ask a maintainer. |

Each report names the exact commit and description it reviewed. Changing either starts a new review; an earlier report never carries over to a new revision.

## What the review reads

- All files in each `submissions/<task-id>/` folder, read as data. Nothing in a PR is executed.
- Either loose files including `task-plan.md`, or a single `submission.zip` with the plan and workbook at its root. Do not mix the two.
- Limits: at most 3 tasks per PR; per task at most 50 files, 8 MiB per file and 7 MiB in total.
- Keep task files and other changes (code, workflows) in separate PRs.

Supported formats are Markdown, text, JSON, CSV, TOML and XLSX with literal values. Workbooks with formulas, macros or external links are not supported.

## Requirements in the description

The review runs only when both boxes are ticked:

- All included material is authorized for public release; no restricted material is attached.
- I authorize automated AI processing of these materials for SPU quality review.

## Check locally before opening a PR

```bash
npm ci
npm run quality -- submissions/<task-id> pr-body.md /tmp/spu-report
```

This runs the same rule checks on the plan and workbook (Python 3 required) and writes a report. It does not run the automated AI review.
