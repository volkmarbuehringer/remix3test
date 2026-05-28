## 1. Controller Changes

- [x] 1.1 Import `isSlotBookable` from `../data/appointofferings.ts` in `admin-appointments-controller.tsx`
- [x] 1.2 Add `isSlotBookable()` check to the `create` action — reject with German error if slot is outside offering hours
- [x] 1.3 Add `isSlotBookable()` check to the `update` action — reject with German error if the changed slot is outside offering hours

## 2. Test Changes

- [x] 2.1 Add integration test for create — succeeds when slot is within offering hours
- [x] 2.2 Add integration test for create — fails with offering error when slot is outside offering hours
- [x] 2.3 Add integration test for create — fails with collision error when time range overlaps another appointment
- [x] 2.4 Add integration test for update — succeeds when slot stays within offering hours (title-only change)
- [x] 2.5 Add integration test for update — fails with offering error when new slot is outside offering hours
- [x] 2.6 Add integration test for update — fails with collision error when new time range overlaps another appointment
