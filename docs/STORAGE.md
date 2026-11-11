# Task storage contract

Task source, large data, container images, and trial outputs have different storage lifecycles. A Harbor task directory is not a serialized container image.

## Storage layout

| Content | Canonical location | Git policy |
| --- | --- | --- |
| Task instructions, configuration, answer contract, verifier and reference code | `benchmark/tasks/<domain>/<task_id>/` | Versioned in the submission repository |
| Small, required fixtures | Task source directory | Within the configured source budget |
| Large inputs and verifier data | Content-addressed blob storage; later an approved organization-owned dataset or object store | Only `assets.json` is committed |
| Built container images | Local container cache or a registry, pinned by digest for release | Never commit image archives |
| Agent trajectories, scores, logs and generated artifacts | A separate run directory keyed by run ID and task commit | Not part of task source |

A local checkout can use `storage/blobs/sha256/<prefix>/<hash>` for optional local blob staging and `storage/runs/<run-id>/` for future trial outputs. `storage/` is excluded from Git and repository exports. An `assets.json` file does not contain absolute workstation paths or credentials.

## Source budgets

Defaults in `benchmark/policy/storage.json`:

- Individual Git file: at most 5 MiB.
- All source files for one task: at most 20 MiB.
- At most 2,000 source files per task.

These are configurable SPU engineering defaults, not Harbor limits or GitHub platform limits. An oversized valid scientific dataset should become a referenced asset rather than be discarded. Runtime folders, virtual environments, symlinks and unresolved LFS pointer stubs fail the storage check.

## External asset manifest

`assets.json` is optional. Tasks without large assets do not need one. Each entry records a role, destination path, exact payload size, SHA-256 digest, and source. Roles are:

- `input`: only agent-visible data, under `assets/input/` or `environment/data/`.
- `verification`: grading-only data, under `assets/verification/`, `tests/data/`, or `tests/reference/`.
- `provenance`: author-side evidence, under `assets/provenance/` or `authoring/provenance/`.

Development assets can use `{"kind":"local"}` after ingestion into the local blob store. For release, each asset needs either an approved Hugging Face dataset with a full immutable revision, or an approved stable HTTPS origin. The approved-provider lists intentionally start empty until the project chooses and verifies its organization-owned storage. URL credentials, query parameters and fragments are rejected. A pinned hash proves identity, not hosting availability or distribution permission.

The roles prevent the materializer from copying verifier-designated files into an input-only bundle. They do not prove that an author has correctly classified a file; scientific and leakage review remain necessary.

```json
{
  "schema_version": "1.0",
  "assets": [
    {
      "id": "input-volume",
      "role": "input",
      "path": "environment/data/volume.bin",
      "sha256": "<actual 64-character SHA-256>",
      "size_bytes": 123456789,
      "source": {"kind": "local"}
    }
  ]
}
```

The digest and byte count above are illustrative placeholders, not a valid downloadable asset.

## Commands

```bash
# Inventory source bytes and declared external bytes separately.
node scripts/storage.mjs audit benchmark/tasks/<domain>/<task_id>

# Require release-approved, immutable external references as well.
node scripts/storage.mjs audit benchmark/tasks/<domain>/<task_id> --release

# Verify a user-supplied local file and store it by content hash.
node scripts/storage.mjs ingest path/to/assets.json \
  --asset input-volume --file /path/to/volume.bin --store storage/blobs

# Compose only agent-visible data into a NEW staging directory.
node scripts/storage.mjs materialize path/to/assets.json \
  --store storage/blobs --out artifacts/input-bundle-001 --role input
```

The tools never download remote data or execute task scripts. Ingestion verifies byte count and SHA-256, reuses an existing verified object, and rejects corrupt objects instead of overwriting them. Materialization requires an explicit role, verifies source objects, copies only that role, and refuses an existing destination. Shared NAS operation uses unique temporary names and content identity rather than cross-machine file locks.

## Validation and release integration

`validateTask` runs the storage inventory before checking the existing SPU task contract. The trusted PR gate also audits Git-tree metadata for the full changed task directories and reads optional asset manifests. This catches large files that the six core SPU text files alone would miss.

The local inventory recognizes both `task.yaml` and `task.toml` for reporting. This does not implement Harbor execution or make the existing SPU validator accept a Harbor-only task. Docker images, expanded data sizes, runtime downloads and scratch-disk requirements cannot be measured from Git byte counts.

Candidate releases include the `assets.json` digest and exact external references. They remain `candidate_not_published`; this command does not verify remote asset availability, GitHub approvals, scientific validity or make a public release.

## Reference design

TBS stores task source in Git, with large data in the organization-owned `harborframework/terminal-bench-science-lfs` Hugging Face dataset. Its contribution guide requires fixed revisions, checksum verification, and separate input versus verification namespaces. See [TBS contribution guide](https://github.com/harbor-framework/terminal-bench-science/blob/31b5a7391fee67f56a097e4d7b2286bcc8fc29d0/CONTRIBUTING.md#hosting-large-task-data), [Harbor task format](https://docs.harborframework.com/tasks/overview), and [Harbor resource declarations](https://docs.harborframework.com/tasks/resources).
