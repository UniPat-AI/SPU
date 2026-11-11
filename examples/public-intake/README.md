# Fictional public-intake walkthrough

This is a format illustration, not an experimental result or a complete submission. Imagine comparing three fictional formulations, A, B, and C, by a measured endpoint.

1. Choose a lowercase task ID such as `example-formulation-ranking` and create `submissions/example-formulation-ranking/`.
2. Complete [task-plan.md](../../templates/submission/task-plan.md): describe the experimental setup, each candidate, what the agent sees, the endpoint and units, and how the ranking will be assessed.
3. Complete [reference-rankings.xlsx](../../templates/submission/reference-rankings.xlsx): use the same task, group, and candidate IDs, record the reference ranks, and define every column in the `Column guide` sheet.
4. Add any supporting evidence that you are authorized to redistribute. Complete the PR template, including the source and permissions declarations and consent to automated processing.

For this fictional example, `higher_first` means rank 1 is assigned to the candidate with the highest endpoint value. Ties, missing values, and any unknown comparisons must be described explicitly. These names and values do not represent real experiments.

Before submitting a real task, follow [CONTRIBUTING.md](../../CONTRIBUTING.md). A full Harbor package is not required for initial intake; packaging, scientific validation, and publication are later steps.
