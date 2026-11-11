# Task plan: <scientific task title>

Shared public/private submission template v1.0. Replace every placeholder. Use N/A with a reason when a section does not apply. Do not remove a section without explaining why.

Submit this plan with `reference-rankings.xlsx`. They form the primary submission; an executable Harbor package can be added later. Use the same content for a public GitHub PR or a private workspace submission. Public PR contents, including answers, must be redistributable; private material stays in the authenticated channel. Include supporting data and define every column. Submission does not establish scientific validity or automatically validate file contents.

## 1. Task identity and scientific objective

- Task ID and version:
- Title, scientific discipline and subfield:
- Authors, affiliations and contact:
- Scientific question and why it matters:
- Capability the model must demonstrate:
- What would make this task scientifically meaningful or difficult:

## 2. Prediction target and comparison groups

- What the model must predict:
- Target metric, units, assay/measurement endpoint and time point:
- Comparison groups and the population/protocol shared within each group:
- Ranking direction: `higher_first` or `lower_first`. Rank 1 is first in that direction, not automatically "best".
- Required model output, including candidate IDs and handling of ties:

## 3. Candidate definitions

List every candidate in each group. Use the same IDs in the model prompt, attached inputs and answer workbook. Avoid identifiers that reveal the answer.

| group_id | candidate_id | Description / identity | Composition / treatment | Dose or quantity with units | Other distinguishing conditions |
| --- | --- | --- | --- | --- | --- |
| <group> | <candidate> | <description> | <conditions> | <value and unit> | <details> |

## 4. Experimental protocol and conditions

Provide enough detail for a domain expert to reconstruct the experiment and assess comparability.

- Materials, samples, reagents, structures and preparation:
- Instrument/equipment models, calibration and relevant settings:
- Quantities, concentrations, dose and units:
- Temperature, pressure, pH, solvent/media and environmental conditions:
- Procedure, timing, order of operations and measurement window:
- Positive/negative controls and baseline conditions:
- Independent and technical replicates, batch structure and sample size:
- Randomization, blinding and allocation:
- Deviations, failed runs and exclusions, with reasons:

## 5. Information available to the model

### Model-visible task prompt

Write the complete, self-contained prompt here. Specify the objective, candidate set, information conditions and expected output. Do not include reference ranks, answer-revealing measurements or the reviewer-only rationale.

<Prompt>

### Model-visible inputs and allowed resources

| File / resource | Contents | Why the model needs it | Allowed access |
| --- | --- | --- | --- |
| <path or URL> | <description> | <purpose> | <local / permitted web / other> |

- Allowed tools, web access and external knowledge:
- Time, token or compute budget, if relevant:
- Explicitly forbidden information or resources:
- Exact output schema with a placeholder-only example:

### Reviewer-only materials

Keep `reference-rankings.xlsx`, ground-truth measurements, answer derivations and confidential evidence out of model-visible files. This plan may contain reviewer-only sections; prepare a separate model-visible prompt when packaging the task.

## 6. Reference data and provenance

- Data origin, collection date and experiment/sample IDs:
- Raw evidence locations (filename, sheet/cell, figure/table or DOI):
- Measurement and quality-control procedures:
- Preprocessing, transformations and normalization:
- Aggregation across replicates and batches:
- Missing data, exclusions and measurement precision:
- Evidence of permission to use the materials:

## 7. Reference ranking and scientific rationale (reviewer-only)

- How each reference rank follows from evidence:
- Scientific mechanism or rationale supporting the ordering:
- Assumptions and alternative interpretations:
- Expert adjudication, where measurements alone do not determine the answer:
- Any differences between raw data and the curated answer, with reasons:

In the workbook, enter one row per candidate per comparison group and use dense ranks: 1, 2, 2, 3. Preserve real zeros; leave unavailable numeric values blank. Do not infer a total ranking from incomplete evidence.

## 8. Ties, uncertainty and missing comparisons

- Prespecified tie definition and numerical/statistical tolerance:
- Uncertainty type, units, confidence level or replicate ranges:
- Candidates whose relative order is unknown and why:
- Candidates excluded from scoring and why:
- If a genuine partial order cannot be represented by ranks, attach an explicit pairwise relation table (group_id, candidate_a, relation, candidate_b, evidence_ref) and define the permitted relations. Do not turn an unknown relation into a tie.

## 9. Scoring and acceptance rules

- Proposed scoring rule and its range:
- Whether scores are per group, pooled or weighted:
- Treatment of ties, unknown pairs and excluded candidates:
- Handling of missing/duplicate/unknown IDs and invalid outputs:
- Worked example showing a hypothetical prediction and its score:
- Conditions required for a task to be considered reproducible and ready for release:

## 10. Reproducibility and task packaging

- File inventory and role of every attachment:
- Environment/software versions, dependencies and seeds:
- Reproduction instructions and expected intermediate checks:
- Expected runtime, compute and storage requirements:
- Existing Harbor package or code, if available:
- Steps still needed before executable packaging:

## 11. Rights, confidentiality and leakage controls

- Material owners and authority to submit for restricted review:
- Redistribution/publication permission and restrictions:
- Which material could eventually become public (separate author consent is still required):
- Separation of model-visible inputs from reference answers and reviewer evidence:
- Prior public exposure, contamination risks and mitigation:

## 12. Limitations and author checklist

- Known confounders, failure modes and unresolved questions:
- [ ] All task, group and candidate IDs match across the plan and workbook.
- [ ] Metric, units, direction and group boundaries are explicit.
- [ ] Ties, unknown relations and exclusions are distinct and justified.
- [ ] Every workbook column, including custom columns, has a description, type, unit and missing-value rule.
- [ ] Every ranked row has locatable evidence; unknown/excluded rows explain the gap.
- [ ] The model-visible task does not contain the answer workbook or answer-revealing evidence.
- [ ] Files and provenance are complete; placeholders and synthetic example rows are removed from the actual answer table.
