# Admin Users Schema Checks

This change has no spec-level impact. It is an implementation improvement within the existing admin/users controller — adding `data-schema/checks` (`email()`, `minLength(1)`) to the existing action schemas and removing the corresponding manual validation. No requirements are added, modified, or removed.
