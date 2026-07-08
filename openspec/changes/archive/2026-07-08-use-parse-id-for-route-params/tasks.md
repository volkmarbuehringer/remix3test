## 1. Verwaltung Controllers

- [ ] 1.1 Replace `Number()` + guard in `verwaltung/resources/controller.tsx` (2 sites: lines 212, 261)
- [ ] 1.2 Replace `Number()` + guard in `verwaltung/offering-configs/controller.tsx` (2 sites: lines 343, 478)

## 2. Admin Controllers

- [ ] 2.1 Replace `Number()` + guard in `admin/users/controller.tsx` (2 sites: lines 180, 244)
- [ ] 2.2 Replace `Number()` + guard in `admin/messages/controller.tsx` (1 site: line 111)
- [ ] 2.3 Replace `Number()` + guard in `admin/lists/controller.tsx` (1 site: line 63)
- [ ] 2.4 Replace `Number()` + guard in `admin/fragments/controller.tsx` (1 site: line 61)

## 3. Client Controller

- [ ] 3.1 Replace `Number()` + guard in `client/controller.tsx` (3 sites: lines 136, 147, 237)

## 4. Appointment Controller

- [ ] 4.1 Replace `Number()` + guard in `appointment/controller.tsx` (4 sites: lines 278, 349, 439, 469)

## 5. Uploads Controller

- [ ] 5.1 Replace `Number()` + guard in `uploads/controller.tsx` (1 site: line 54)

## 6. Verify

- [x] 6.1 Run `npm run typecheck` to confirm no type errors
- [x] 6.2 Run `npm test` to confirm all tests pass (1 pre-existing Mastra failure unrelated)
