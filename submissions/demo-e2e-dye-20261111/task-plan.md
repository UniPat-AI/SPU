# Task plan: Aqueous solubility of five fictional azo dyes at 25 °C

> **DEMO — synthetic walkthrough.** Every compound, measurement and value in this submission is invented to show the SPU contribution and review process end to end. It is not an experiment, is never merged and is excluded from all SPU statistics.

Shared public/private submission template v1.0. This is the 9 November 2026 software regression fixture, reusing invented values from the earlier demonstration. The task is not eligible for scientific acceptance or merging.

## 1. Task identity and scientific objective

- Task ID and version: `demo-e2e-dye-20261111`, v1.0
- Title, scientific discipline and subfield: Aqueous solubility of five fictional azo dyes at 25 °C; Chemistry; physical organic chemistry
- Authors, affiliations and contact: SPU maintainers (UniPat AI), demo only
- Scientific question and why it matters: Given only the structures and substituents of five azo dyes, can a model rank their equilibrium solubility in water? Solubility drives formulation and dye-bath design.
- Capability the model must demonstrate: Relating ionizable groups, hydrogen bonding, molecular size and crystal packing to aqueous solubility.
- What would make this task scientifically meaningful or difficult: Two dyes carry the same ionizable group but differ in symmetry, so packing rather than polarity alone decides their order.

## 2. Prediction target and comparison groups

- What the model must predict: The order of equilibrium aqueous solubility of the five dyes.
- Target metric, units, assay/measurement endpoint and time point: Equilibrium solubility in mg/mL, shake-flask method, 25 °C, after 48 h.
- Comparison groups and the population/protocol shared within each group: One group, `water-25c`; all five dyes measured with the same protocol and buffer.
- Ranking direction: `higher_first` (rank 1 = most soluble).
- Required model output, including candidate IDs and handling of ties: A full order of `dye_A` … `dye_E`; ties are not allowed in the prediction.

## 3. Candidate definitions

| group_id | candidate_id | Description / identity | Composition / treatment | Dose or quantity with units | Other distinguishing conditions |
| --- | --- | --- | --- | --- | --- |
| water-25c | dye_A | Fictional 4-aminoazobenzene with one sulfonate (sodium salt) | Excess solid in buffer | 50 mg in 1 mL | Asymmetric |
| water-25c | dye_B | Fictional azobenzene with two sulfonates (disodium salt) | Excess solid in buffer | 50 mg in 1 mL | Symmetric |
| water-25c | dye_C | Fictional neutral 4-hydroxyazobenzene | Excess solid in buffer | 50 mg in 1 mL | No ionizable group at pH 7 |
| water-25c | dye_D | Fictional azobenzene with one carboxylate (sodium salt) | Excess solid in buffer | 50 mg in 1 mL | Asymmetric |
| water-25c | dye_E | Fictional neutral 4-dimethylaminoazobenzene | Excess solid in buffer | 50 mg in 1 mL | No ionizable group at pH 7 |

## 4. Experimental protocol and conditions

- Materials, samples, reagents, structures and preparation: Fictional dyes, >98% purity (invented), dried 24 h at 60 °C.
- Instrument/equipment models, calibration and relevant settings: UV-vis at each dye's λmax against a five-point calibration (invented).
- Quantities, concentrations, dose and units: 50 mg solid per 1 mL buffer.
- Temperature, pressure, pH, solvent/media and environmental conditions: 25.0 ± 0.1 °C, 1 atm, 10 mM phosphate buffer pH 7.0.
- Procedure, timing, order of operations and measurement window: Shake 48 h, settle 2 h, filter 0.22 µm, dilute, measure absorbance.
- Positive/negative controls and baseline conditions: Buffer blank; a reference dye of known solubility (invented).
- Independent and technical replicates, batch structure and sample size: Three independent flasks per dye, one batch.
- Randomization, blinding and allocation: Flask order randomized.
- Deviations, failed runs and exclusions, with reasons: None.

## 5. Information available to the model

### Model-visible task prompt

Rank five azo dyes (`dye_A` … `dye_E`, described below) by equilibrium aqueous solubility at 25 °C in 10 mM phosphate buffer, pH 7.0, from most to least soluble. Return a full order of all five IDs with no ties. The candidate table in Section 3, without any measured values, is supplied.

### Model-visible inputs and allowed resources

| File / resource | Contents | Why the model needs it | Allowed access |
| --- | --- | --- | --- |
| Candidate table (Section 3) | Structures and substituents | Defines the candidates | local |

- Allowed tools, web access and external knowledge: General chemistry knowledge and computation; web search allowed.
- Time, token or compute budget, if relevant: 1 hour.
- Explicitly forbidden information or resources: The workbook and Sections 6–8 of this plan.
- Exact output schema with a placeholder-only example: `{"task_id":"demo-e2e-dye-20261111","rankings":[{"group_id":"water-25c","order":["<id>","<id>","<id>","<id>","<id>"]}]}`

### Reviewer-only materials

`reference-rankings.xlsx` and Sections 6–8 are reviewer-only.

## 6. Reference data and provenance

- Data origin, collection date and experiment/sample IDs: Invented for this demo on 29 October 2026; no experiment exists.
- Raw evidence locations (filename, sheet/cell, figure/table or DOI): `reference-rankings.xlsx`, Rankings sheet, column `observed_value`.
- Measurement and quality-control procedures: As in Section 4 (invented).
- Preprocessing, transformations and normalization: Mean of three flasks.
- Aggregation across replicates and batches: Arithmetic mean.
- Missing data, exclusions and measurement precision: None missing.
- Evidence of permission to use the materials: Synthetic content written by the SPU maintainers; CC BY 4.0.

## 7. Reference ranking and scientific rationale (reviewer-only)

- How each reference rank follows from evidence: Ranks follow the invented mean solubilities in the workbook.
- Scientific mechanism or rationale supporting the ordering: Two sulfonates (dye_B) > one sulfonate (dye_A) > one carboxylate (dye_D) > hydroxyl (dye_C) > dimethylamino (dye_E).
- Assumptions and alternative interpretations: The symmetric dye_B could pack tightly and fall below dye_A; the invented values place it first.
- Expert adjudication, where measurements alone do not determine the answer: Not needed.
- Any differences between raw data and the curated answer, with reasons: None.

## 8. Ties, uncertainty and missing comparisons

- Prespecified tie definition and numerical/statistical tolerance: Two dyes are tied when their mean solubilities differ by less than the larger of their two SDs. No pair in this demo meets that rule, so all five ranks are distinct.
- Uncertainty type, units, confidence level or replicate ranges: Absolute sample standard deviation of three independent flasks, in mg/mL (the same unit as `observed_value`).
- Candidates whose relative order is unknown and why: None.
- Candidates excluded from scoring and why: None.

## 9. Scoring and acceptance rules

- Proposed scoring rule and its range: Spearman correlation between predicted and reference order, −1 to 1.
- Whether scores are per group, pooled or weighted: One group.
- Treatment of ties, unknown pairs and excluded candidates: None present.
- Handling of missing/duplicate/unknown IDs and invalid outputs: Invalid output scores −1.
- Worked example showing a hypothetical prediction and its score: Predicting A, B, D, C, E swaps one adjacent pair: ρ = 0.9.
- Conditions required for a task to be considered reproducible and ready for release: Not applicable; demo only.

## 10. Reproducibility and task packaging

- File inventory and role of every attachment: `task-plan.md` (this plan), `reference-rankings.xlsx` (reviewer-only answers).
- Environment/software versions, dependencies and seeds: None.
- Reproduction instructions and expected intermediate checks: Not applicable; values are invented.
- Expected runtime, compute and storage requirements: Negligible.
- Existing Harbor package or code, if available: None.
- Steps still needed before executable packaging: None; this task is never packaged.

## 11. Rights, confidentiality and leakage controls

- Material owners and authority to submit for restricted review: SPU maintainers.
- Redistribution/publication permission and restrictions: CC BY 4.0; no restrictions.
- Which material could eventually become public (separate author consent is still required): All of it; it is a public demo.
- Separation of model-visible inputs from reference answers and reviewer evidence: Only the Section 5 prompt and Section 3 table are model-visible.
- Prior public exposure, contamination risks and mitigation: None; the dyes are fictional.

## 12. Limitations and author checklist

- Known confounders, failure modes and unresolved questions: Synthetic values; no scientific claim is made.
- [x] All task, group and candidate IDs match across the plan and workbook.
- [x] Metric, units, direction and group boundaries are explicit.
- [x] Ties, unknown relations and exclusions are distinct and justified.
- [x] Every workbook column, including custom columns, has a description, type, unit and missing-value rule.
- [x] Every ranked row has locatable evidence; unknown/excluded rows explain the gap.
- [x] The model-visible task does not contain the answer workbook or answer-revealing evidence.
- [x] Files and provenance are complete; placeholders are removed. The template's synthetic example sheet is removed; for this walkthrough the answer table itself is intentionally synthetic and labelled DEMO.
