# Contributing a task

SPU grows through experiments contributed by the community. A task asks an agent to rank the candidates of one real experiment by its measured outcome, using only what a scientist knows before running it.

## Two routes, one format

- **Public, redistributable data** (published papers, open datasets, your own open data): open a pull request in this repository.
- **Unpublished or restricted experiments**: do not open a PR, issue or comment. Use the private workspace on the [SPU project site](https://spu.unipat.ai/#/workspace); it takes the same files.

Both routes use the same materials: a detailed `task-plan.md`, a `reference-rankings.xlsx` workbook and supporting data. Start from the [templates](templates/submission/README.md); the [fictional walkthrough](examples/public-intake/README.md) shows how they fit together.

## Open a pull request

Put the files under `submissions/<task-id>/`, with a lowercase task ID (letters, digits, `-` or `_`):

```text
submissions/<task-id>/
  task-plan.md
  reference-rankings.xlsx
  data/                    # supporting evidence, when needed
  data-dictionary.md       # custom columns not covered by the Column guide
```

A single `submission.zip` with the plan and workbook at its root also works; do not mix it with loose files.

Title the PR `[Task] <task-id>: <scientific title>` and fill in the description template. For a correction to an existing task, use `[Fix] <task-id>: <what this corrects>` and the fix template (add `?template=fix.md` to the compare URL). The rules are in [docs/PR-FORMAT.md](docs/PR-FORMAT.md).

What the plan and workbook must cover:

- the scientific objective, candidates, protocol and conditions, and what the agent may see;
- the measured endpoint, its unit and the ranking direction;
- every data column: meaning, type, unit, allowed values and missing-value rule;
- locatable evidence and a rationale for the reference ranking;
- ties, uncertainty, exclusions and unknown comparisons (unknown is not a tie);
- reference answers and revealing evidence kept separate from solver-visible inputs.

An executable Harbor package is not needed to start; it is built after review.

## Review

Each task PR is checked automatically (`spu/pr-format`, `spu/clarity-audit`); see [docs/REVIEW.md](docs/REVIEW.md). Address findings by updating the same PR; every push or description edit is reviewed again. The automated review checks completeness and clarity only. Maintainers decide on scientific acceptance, and accepted tasks are packaged and validated before they join a dataset release.

To run the rule checks locally first:

```bash
npm ci
npm run quality -- submissions/<task-id> pr-body.md /tmp/spu-report
```

## Rights

Everything in a public PR, including reference answers, is published. Include only material you may redistribute, and state its license or permission in the description.

## Reporting a problem

Open a task issue for an error in a released task, its data or its scoring. Link the issue from the fix PR that resolves it.
