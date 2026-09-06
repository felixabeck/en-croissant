# Preserve findings breadcrumb failure context

Repo: /home/felixb/Projekte/chessfable, branch master. Entry: lens (inline correction plus error-handling lens). Work from the finding titled "Findings breadcrumb failure discards the captured cause" in tasks/findings.md; its ID is allocated by the ledger CLI.

The native-fs run synchronized committed agent-kit support in 33559689. The error-handling lens found scripts/findings.py:272-288 discards captured helper stderr and exceptions. Calling the real function with a missing DRAIN_BREADCRUMB_LIB emits only a generic breadcrumb warning, leaving no cause. Ledger success despite an auxiliary breadcrumb failure remains intentional.

This belongs to shared tooling, outside the descriptor-read implementation. Read canonical /home/felixb/Projekte/agent-kit/scripts/findings.py and its test_set_header_missing_breadcrumb_library_keeps_success_and_reports_once regression. Preserve nonfatal success and one warning, include useful safe failure context, test the actual producer, commit owned kit files, then use guarded kit sync to propagate. Do not modify the vendored script by hand. Check related findings f-20260829-14 and f-20260830-15; neither is this mechanism.

Plan authorship and arbitration shared one context; detection ran on the same model family as the code.
