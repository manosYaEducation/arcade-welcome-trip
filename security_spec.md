# Security Specification — Arcade Welcome Trip

## 1. Data Invariants
1. **Identity Integrity (`Attendee.authorUid` & `AttendeeContact.authorUid`)**: An attendee registration or contact record can only be created if `incoming().authorUid == request.auth.uid` (or by `isAdmin()`) and the user has a verified email (`request.auth.token.email_verified == true`).
2. **PII Split-Collection Isolation (`AttendeeContact`)**: Optional WhatsApp phone numbers are strictly isolated in `/attendeeContacts/{attendeeId}`. Blanket reads are forbidden: only the document owner (`resource.data.authorUid == request.auth.uid`) or `isAdmin()` can read (`get`/`list`) or write `/attendeeContacts/{attendeeId}`.
3. **Admin-Only Tombola Prize Assignment (`Attendee.prizeWon`)**: During attendee creation, `prizeWon` must be `""` unless created by `isAdmin()`. During updates, a non-admin owner can ONLY modify `['arcadeScore', 'maxCombo', 'playedArcade', 'updatedAt']`. Only `isAdmin()` can update `prizeWon`.
4. **Admin-Only Event Config, Prize Inventory & Event History**: Only `isAdmin()` can write to `/eventConfig/{configId}`, `/prizes/{prizeId}`, `/eventHistory/{historyId}`, and `/admins/{adminUid}`. `/eventHistory` records are immutable once archived (`allow update: if false;`).
5. **Temporal & Immutable Field Integrity**: `createdAt` must equal `request.time` on creation and remain immutable on update. `updatedAt` must equal `request.time` on every write.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Shadow Field Injection on Attendee**: Adding `"isAdmin": true` to `/attendees/{id}` -> Blocked by `data.keys().hasOnly(...)`.
2. **PII Leak Attempt on `/attendeeContacts`**: Authenticated non-owner attempting `get` or `list` on another user's `/attendeeContacts/{id}` -> Blocked by `resource.data.authorUid == request.auth.uid || isAdmin()`.
3. **Self-Assigned Prize on Create**: Attendee creating `/attendees/{id}` with `"prizeWon": "Pase VIP"` -> Blocked by `incoming().prizeWon == "" || isAdmin()`.
4. **Self-Assigned Prize on Update**: Attendee updating `/attendees/{id}` changing `prizeWon` -> Blocked by `affectedKeys().hasOnly(['arcadeScore', 'maxCombo', 'playedArcade', 'updatedAt'])`.
5. **UID Spoofing on Create**: Setting `authorUid: "someone_else"` -> Blocked by `incoming().authorUid == request.auth.uid || isAdmin()`.
6. **Immutable Field Mutation**: Changing `authorUid` or `createdAt` during update -> Blocked by immutability checks.
7. **Timestamp Forgery**: Sending a past or future `updatedAt` timestamp -> Blocked by `incoming().updatedAt == request.time`.
8. **Denial-of-Wallet Oversized String**: Sending a 50,000-char string in `name` or `attendeesSummary` -> Blocked by strict `.size()` bounds.
9. **ID Poisoning**: Creating `/attendees/invalid id with spaces!` -> Blocked by `isValidId(attendeeId)`.
10. **Unverified Email Spoofing**: Attacker with `email: "asus.alphadocere@gmail.com"` and `email_verified: false` -> Blocked by `request.auth.token.email_verified == true`.
11. **Unauthorized History Mutation**: Non-admin attempting to read or write `/eventHistory/{historyId}` -> Blocked by `isAdmin()`.
12. **Privilege Escalation via `/admins` Write**: Non-admin writing to `/admins/{uid}` -> Blocked by `isAdmin()`.
