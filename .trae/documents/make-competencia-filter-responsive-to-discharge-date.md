# Plan: Make "Competência SIH" Filter Responsive to Discharge Date

## Current Behavior
The "Competência SIH" filter loads ALL available competências from the entire `sih_rd` table, regardless of any discharge date filter selection. This is done in the `loadCompetencias` useEffect (lines 256-297).

## Desired Behavior
When a discharge date range ("Data de Alta") is selected, the "Competência SIH" filter should only show competências that have records within that date range. The date filter should be applied to the query that loads competências.

## Implementation Steps

### Step 1: Modify the `loadCompetencias` useEffect
**Location**: Lines 256-297

**Current logic**:
- Queries `sih_rd` selecting only `ano_cmpt, mes_cmpt`
- Optionally filters by `selectedHospital`
- Does NOT apply any date filter

**New logic**:
- Keep the same pagination approach
- Add date filter conditions when `hasDateFilter` is true:
  - `.not('dt_saida', 'is', null)`
  - `.gte('dt_saida', dischargeFrom)`
  - `.lt('dt_saida', endExclusive)`
- This ensures only competências with discharge dates in the selected range are loaded

**Code changes**:
```typescript
// Inside the for loop where q is built (around line 267):
let q = supabaseSih
  .from('sih_rd')
  .select('ano_cmpt, mes_cmpt')
  .range(offset, offset + pageSize - 1)
if (selectedHospital !== 'all') q = q.eq('hospital_id', selectedHospital)
// ADD: Apply date filter if set
if (hasDateFilter) {
  q = q.not('dt_saida', 'is', null).gte('dt_saida', dischargeFrom).lt('dt_saida', endExclusive)
}
```

### Step 2: Ensure `hasDateFilter`, `dischargeFrom`, `endExclusive` are in scope
These variables are already defined in the component (around lines 327-337). They should be accessible inside the useEffect. Verify that they are in the closure scope.

**Current useEffect dependencies**: `[open, selectedHospital]`

**Potential update**: May need to add `hasDateFilter`, `dischargeFrom`, `endExclusive` to the dependency array to ensure competências reload when date filter changes.

**Consideration**: If we add date filter dependencies, the effect will re-run every time the date changes. This is the desired behavior - we want the competência options to update dynamically.

**New dependency array**: `[open, selectedHospital, hasDateFilter, dischargeFrom, endExclusive]`

### Step 3: Handle edge cases
- When date filter is cleared (hasDateFilter becomes false), the effect should reload ALL competências (for the selected hospital) - this happens automatically because the condition `if (hasDateFilter)` won't add the filter
- When date fields are incomplete (hasDateFilter true but dates empty), the effect should not run or should handle gracefully - currently `hasDateFilter` is only set to true when both dates are valid, so this is already handled

### Step 4: Test the flow
1. Open dialog
2. Select a hospital (optional)
3. Select discharge date range
4. Verify that "Competência SIH" dropdown only shows competências that have records with `dt_saida` in that range
5. Change date range - competências should update
6. Clear date range - competências should show all available

## Expected Outcome
- The competência filter becomes context-aware and only shows relevant options based on the discharge date selection
- Better UX - users won't see competências that have no data in their selected date range
- Consistent with the report generation logic which already applies both date and competence filters

## Notes
- The `applyCompFilter` function remains unchanged - it still filters by selected competências during report generation
- The change only affects which competências are *available to select* in the UI, not how the report is generated
- Performance: The additional date filter in the competência loading query should be efficient if there's an index on `dt_saida` (which is likely given it's used in range queries)
