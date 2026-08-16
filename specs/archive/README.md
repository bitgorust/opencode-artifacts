# Archived changes

Verified and withdrawn packets are stored as `<YYYY-MM-DD>-<change-id>`. They preserve
decision and evidence history but do not override [`../current/`](../current/) or the target
product specification. Status `archived` means delivered and verified; status `withdrawn`
means not delivered and retains its actor, timestamp, and reason.

Archive through `npm run spec -- archive <change-id>` so the final gates run before the move.
Use `npm run spec -- withdraw ...` for a rejected or abandoned proposal that has not updated
current truth.
