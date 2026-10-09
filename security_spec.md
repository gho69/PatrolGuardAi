# Security Specification: PatrolGuard AI Client Storage

## 1. Data Invariants
1. Each client profile belongs strictly to the authenticated user `/users/{userId}/clients/{clientId}`.
2. The user ID path parameter must strictly match `request.auth.uid`.
3. Client profile ID in the payload must strictly match the Firestore document ID (`incoming().id == clientId`).
4. Client profile name must be non-empty and bounded (1-100 characters).
5. Numerical boundaries: rounds per shift (0-100), tags per site (1-500).
6. Time fields must be formatted strings under 10 characters.
7. Path variable document IDs must conform to `^[a-zA-Z0-9_\-]+$` with length <= 128.
8. Unauthenticated requests and cross-user accesses are strictly denied.

## 2. The Dirty Dozen Payloads (Rejection Matrix)
1. **Unauthenticated Read**: Attempting to read `/users/user123/clients` without authentication. -> PERMISSION_DENIED
2. **Unauthenticated Write**: Attempting to create `/users/user123/clients/client1` without auth. -> PERMISSION_DENIED
3. **Cross-Tenant Impersonation**: User A attempting to read `/users/userB/clients`. -> PERMISSION_DENIED
4. **Cross-Tenant Write**: User A attempting to create client in `/users/userB/clients/client1`. -> PERMISSION_DENIED
5. **ID Mismatch Attack**: Creating `/users/userA/clients/client1` with body `{ id: "client2" }`. -> PERMISSION_DENIED
6. **Path Injection (ID Poisoning)**: Creating with document ID `../../system/root`. -> PERMISSION_DENIED
7. **Gigabyte Name Flooding**: Creating client with 50,000 character `name`. -> PERMISSION_DENIED
8. **Missing Required Fields**: Creating client without `roundsPerShift` or `nightStart`. -> PERMISSION_DENIED
9. **Negative Rounds Constraint Violation**: Updating `roundsPerShift: -5`. -> PERMISSION_DENIED
10. **Unverified Email Access**: Writing with `email_verified == false` token. -> PERMISSION_DENIED
11. **Immutable ID Mutation**: Updating client with modified `id` field. -> PERMISSION_DENIED
12. **Blanket Query Access**: Listing the root `/users` collection directly. -> PERMISSION_DENIED
