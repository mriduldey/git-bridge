# Documentation Style Guide

Architecture documentation is derived from accepted ADRs. Do not introduce
independent architecture in guides, diagrams, or README files.

## Rules

- Treat ADR-001 through ADR-015 as authoritative.
- Keep derived docs concise and navigable.
- Prefer provider-neutral terminology.
- Use package names and public type names exactly as implemented.
- Link to ADRs for rationale.
- Keep diagrams in Mermaid format.
- Avoid documenting provider SDK details as public API.
- Update documentation when public behavior, package boundaries, or release
  processes change.

## Audience

- README: quick start and package overview.
- Architecture overview: system structure and boundary summary.
- ADRs: rationale and authoritative decisions.
- Examples: executable usage through public APIs only.
- Package READMEs: package-specific guidance.

## Review Checklist

- The document does not contradict accepted ADRs.
- Public APIs are described with exported names only.
- Provider SDK models and clients are not presented as public contracts.
- Examples compile and avoid private or source imports.
- Diagrams match package and runtime boundaries.
