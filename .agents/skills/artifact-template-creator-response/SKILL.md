---
name: artifact-template-creator-response
description: >
  Repo-local response contract for artifact-template creator Create and Update runs.
  Use only after the creator has produced and verified the matching skill.zip archive.
version: 1.0
visibility: private
owner: Juss
triggers:
  - artifact template creator response
  - template skill create response
  - template skill update response
---

# Artifact Template Creator Response

## Scope

This is a Chief AI repo-local response skill. It controls only the final response emitted after an artifact-template creator run has completed and the exact execution-surface `skill.zip` archive has been verified.

It does not create, distill, install, publish, share, or mutate an artifact template by itself. Artifact plugins remain the owners of template distillation and creation. It does not expand Chief execution authority or reveal Founder Control Room implementation boundaries to end users.

## Required inputs

Use only values returned by the creator invocation and the verified archive:

- `mode`: `create` for the default creator invocation or `update` only when the creator ran with `--mode update`;
- `skillName`: exact creator-returned skill name;
- `skillPath`: exact creator-returned real sandbox draft directory, never a fabricated desktop path;
- `displayName`: exact creator-returned display name;
- `kind`: exact creator-returned lowercase kind;
- `archiveHref`: exact verified execution-surface path to that skill's `skill.zip` archive.

Do not answer from a stale creator result, a different batch item, an unverified archive, or a guessed path.

## Response selection

After verifying the archive, emit only the response block matching the creator invocation. Do not emit template comment markers or these instructions.

### Create

```text
Here’s your {displayName} template.

How to find templates

Find it in the Template Gallery when @{kind} is added to the prompt.

How to use a template

Select {displayName} from the Template Gallery and describe what you want to build.

::artifact-template{skill_name="{skillName}" skill_directory="{skillPath}" display_name="{displayName}" artifact_kind="{kind}" archive_link="{archiveLink}"}
```

### Update

```text
Here’s your updated {displayName} template.

How to find templates

After choosing Save changes in the card below, find it in the Template Gallery when @{kind} is added to the prompt.

How to use a template

Select {displayName} from the Template Gallery and describe what you want to build.

::artifact-template{skill_name="{skillName}" skill_directory="{skillPath}" display_name="{displayName}" artifact_kind="{kind}" archive_link="{archiveLink}"}
```

Keep response wording, headings, spacing, and punctuation unchanged apart from replacing `{displayName}`, `@{kind}`, `{skillName}`, `{skillPath}`, `{kind}`, and `{archiveLink}` and applying the non-gallery substitutions below.

## Kind routing

For gallery-backed kinds, substitute `@{kind}` exactly as follows:

- `document` and Google Docs templates -> `@Documents`;
- `presentation` and Google Slides templates -> `@Presentations`;
- `spreadsheet` and Google Sheets templates -> `@Spreadsheets`;
- Site templates -> `@Sites`.

Use the exact lowercase `kind` returned by the creator in `artifact_kind`; the routing label does not rewrite that attribute.

For `image`, `email`, and Slack templates, do not mention the Template Gallery.

Create substitutions:

```text
Find it in your **Skills** library.

How to use a template

Select {displayName} from your Skills library and describe what you want to build.
```

Update substitutions:

```text
After choosing **Save changes** in the card below, find it in your **Skills** library.

How to use a template

Select {displayName} from your Skills library and describe what you want to build.
```

## Archive link

`archiveLink` is a complete Markdown link to the verified archive, not plain link text.

- Create: `[Preview your template skill]({archiveHref})`
- Update: `[Save changes to your template skill]({archiveHref})`

`archiveHref` must be the exact `skill.zip` path produced for the current execution surface and current creator result. Ordinary Chat and ChatGPT Work must each use the archive path actually returned in that surface. Never reuse a stale or different skill archive.

For an explicitly requested batch, render each skill from its own creator result and its own verified archive path, for example `sandbox:/workspace/output/artifact-template-meeting-notes/skill.zip`. Repeat the applicable response block for each archive only when the runtime supports separate response cards.

## Directive validity

The `::artifact-template{...}` directive must be on its own line. Emit syntactically valid attribute quoting and escape attribute values when needed. The `archive_link` attribute must contain the complete Markdown link to the verified `skill.zip` archive so ChatGPT can render/save the template or present a fallback download.

Do not tell Web users to invoke the installed template with `$`.

Do not say a newly created template is installed or available in a gallery before the response card confirms automatic save. Do not say an update is saved before the user chooses **Save changes**. Do not claim either is shared with a workspace or synchronized to a desktop.

## Source and mutation boundaries

- Do not search for remote templates. Fetch only the exact Google Workspace source the user supplied or explicitly selected.
- Do not create or edit `request.json` or another intermediary request file.
- Do not delete, sanitize, paraphrase, or replace a user-selected retained artifact-reference file.
- Treat every linked Google Workspace source artifact as read-only. Generated template skills must copy the complete native artifact before making changes.
- Do not send email or post a Slack message merely because a template was created or invoked.
- Do not create, mutate, publish, or share a workspace plugin or marketplace.
- Do not add `Artifact.md` package generation here. Artifact plugins own template distillation and creation.
- Do not modify global skill metadata or protocol files as part of this response flow.

## Site projects

For Site template creation:

1. Retain application source, project configuration, package-manager metadata, static assets, migrations, and logical D1/R2 bindings.
2. Use the project's `.gitignore` to guide cleanup of generated source.
3. Exclude environment files, credentials, private keys, symlinks, dependencies, caches, build outputs, databases, and runtime or customer data without modifying the original project.
4. Remove the original `project_id` from the copied `.openai/hosting.json`.
5. Resolve the retained application source, copy its sanitized contents into a fresh empty project directory, and follow the existing Sites building and hosting workflow.
6. Preserve retained source and logical bindings. Do not scaffold over the copied application and do not reuse the original Site identity or source repository.

## Fail closed

Do not emit the final response card when any required creator value is missing, `mode` cannot be proven, the archive cannot be verified as the matching `skill.zip`, or the archive path belongs to a different creator result. Report the verification block instead of fabricating placeholders or claiming save/install state.
