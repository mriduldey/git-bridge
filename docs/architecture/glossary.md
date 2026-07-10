# Glossary

## ADR

Architecture Decision Record. ADR-001 through ADR-015 are accepted and frozen.

## Architecture Constitution

The complete set of accepted ADRs that governs SourceAxis implementation and
evolution.

## Capability

A cohesive service exposed from `RepositoryRef`, such as `files`, `tree`,
`history`, or `search`.

## Core

The runtime package that owns client lifecycle, provider registration, provider
resolution, repository creation, and repository references.

## Provider

A package that adapts one repository host to SourceAxis contracts. Providers are
not the public programming model.

## Provider Session

A provider-scoped runtime object that owns capability implementations for one
repository.

## Repository

A provider-neutral service object representing repository identity and metadata.

## RepositoryRef

A lightweight service object binding repository operations to an explicit Git
reference.

## Transport

The provider-neutral abstraction that executes infrastructure requests for
providers.

## Value Model

An immutable data object returned by public APIs, such as `RepositoryInfo`,
`Commit`, `Branch`, `FileInfo`, or `Issue`.
