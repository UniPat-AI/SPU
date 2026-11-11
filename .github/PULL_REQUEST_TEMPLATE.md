<!--
Title format (checked automatically):
  New task:   [Task] <task-id>: <scientific title>
  Example:    [Task] organoboron-fluorescence-yield: Ranking absolute fluorescence quantum yields of eight organoboron dyes
<task-id> must equal your folder name submissions/<task-id>/ (lowercase letters, digits, - or _).
Fixing an existing task? Use the fix template instead: add ?template=fix.md to the "Open a pull request" URL.
Private experiments or uncertain redistribution rights: do not open a PR; use the private workspace on the SPU website.
-->

## Task

- Task ID: <task-id>
- Discipline: <Chemistry / Materials science / Biology / Medicine / Other>
- Subfield: <e.g. organocatalysis>
- Scientific question: <one or two sentences: what outcome does the agent predict?>
- Prediction target and ranking direction: <measured quantity, unit, higher-first or lower-first>
- Candidates and comparison groups: <number of candidates, number of groups>
- Fixes #<issue> (only when resolving an issue):

## Files

Place everything under `submissions/<task-id>/`. Templates are in [`templates/submission/`](https://github.com/UniPat-AI/SPU/tree/main/templates/submission).

- [ ] `task-plan.md`: every template section complete, or marked N/A with a reason
- [ ] `reference-rankings.xlsx`: Rankings sheet filled; Column guide explains every column
- [ ] Supporting data in `data/`, or stable references to it in the plan

## Data source

Public PR contents, including reference answers, are published. Use the private workspace for unpublished or restricted material.

- Source type: <public dataset / published research / own open data / mixed>
- Source title, owner and version: <dataset or paper title, authors or lab, version or date>
- DOI, URL or identifiers: <https://doi.org/...>
- License or permission to redistribute every included file: <license name and link, or the permission you hold>
- Raw data included vs referenced: <what is in this PR, what is only linked>
- Restrictions or conflicts of interest: <or "None">

## Completeness

- [ ] All data columns have a meaning, type, unit, allowed values and missing-value rule.
- [ ] Candidate and group IDs agree between plan, inputs and workbook.
- [ ] Experimental conditions, controls, measurements and processing are described.
- [ ] Reference rankings have locatable evidence and a scientific rationale.
- [ ] Ranking direction, ties, uncertainty, exclusions and unknown comparisons are explicit.
- [ ] Reference answers and revealing evidence are separated from solver-visible inputs.
- [ ] All included material is authorized for public release; no restricted material is attached.

- [ ] I authorize automated AI processing of these materials for SPU quality review.

## Review responses

When you update this PR after review, list the sections, sheets or columns you changed. The `spu/clarity-audit` status links to the report for the exact commit; completeness review does not establish scientific validity or approve a merge.
