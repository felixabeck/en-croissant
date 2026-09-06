# Handoff: unknown saved download destination

=== PROMPT START ===
Work f-20260906-16 through next-finding/build. Read the complete finding, handled f-20260831-15 and d-20260906-09. Trace download-destination-capability in atoms and AccountCard.ensureDownloadDestination. A shape-valid saved ID already absent from native authority is returned forever, so the download fails without reaching the picker. Design bounded native-validity/re-selection recovery that distinguishes missing authority from offline, permission and other download failures; never clear a valid offline destination or repick for every error. Test unknown-ID recovery after reload and preservation of known/offline IDs. This is not a startup-GC defect: the ownership build preserves every known saved destination, but cannot reconstruct a path behind authority already missing before startup. Keep raw native paths out of renderer state/IPC and follow project native capability rules, review and gates.
=== PROMPT END ===

