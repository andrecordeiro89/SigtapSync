# Plan: Fix TypeScript Issues in HybridSourceDialog.tsx

## Questions Answered

### 1. What is `cnesVariants` and why is it not declared?
- **Purpose**: `cnesVariants` is an array of CNES (hospital registry number) variants used as a **fallback mechanism**. When fetching remote SIH data by `hospital_id` returns no results, the code attempts to fetch by CNES instead (using `.in('cnes', cnesVariants)`). This handles cases where the hospital might be indexed by CNES in the SIH database rather than by internal hospital_id.
- **Why missing**: During the refactoring to make remote SIH primary, the declaration of `cnesVariants` was accidentally removed. It needs to be restored.

### 2. Does the local database overwrite the remote database data?
**No.** In the new remote-primary logic:
- Remote SIH data is the **primary source** and always provides the core fields (AIH number, discharge date, hospital, competence, procedures, etc.)
- Local database (`gsus_aihs_patients`) is only fetched **for AIHs that exist in remote** (supplemental)
- Local data **enriches** remote entries by filling in missing patient information (`patient_name`, `prontuario`) only when remote lacks it
- Remote fields are never overwritten by local data; local data only fills gaps

## Current TypeScript Errors

From build output:
```
ERROR: The symbol "remoteAihFoundCount" has already been declared
```

Additional potential issues:
- `cnesVariants` is used but not declared (line 602, 608)
- `remoteAihFoundCount` declared twice (line 725 and line 1217)
- `remoteFoundAihKeys` may be undefined after our changes (used at line 1217)

## Step-by-Step Fixes

### Step 1: Remove Duplicate `remoteAihFoundCount`
- **Location**: Line 1217
- **Action**: Delete the line `const remoteAihFoundCount = selectedHospital !== 'all' ? remoteRdByAih.size : remoteFoundAihKeys.size`
- **Reason**: Already declared at line 725; we should use that value throughout

### Step 2: Remove Reference to `remoteFoundAihKeys` in Metrics
- After removing line 1217, the `info` object (line 1219) will use the `remoteAihFoundCount` from line 725
- No changes needed to `info` object; it already references `remoteAihFoundCount`

### Step 3: Declare `cnesVariants`
- **Location**: After hospital data is available, before the remote fetch blocks (around line 564, before Step 1)
- **Logic**:
  - If `selectedHospital !== 'all'`, get the selected hospital's CNES from `hospitals` array
  - Generate CNES variants (with/without leading zeros, different lengths) to handle formatting variations
  - If `selectedHospital === 'all'`, set to empty array (fallback not needed)
- **Implementation**:
  ```typescript
  // Generate CNES variants for fallback query (when hospital_id filter fails)
  const cnesVariants: string[] = (() => {
    if (selectedHospital === 'all') return []
    const hosp = hospitals.find(h => h.id === selectedHospital)
    const rawCnes = hosp?.cnes || ''
    const digits = rawCnes.replace(/\D/g, '')
    if (!digits) return []
    const set = new Set<string>()
    set.add(digits)
    set.add(digits.padStart(7, '0')) // CNES is typically 7 digits
    // Possibly add more variants if needed
    return Array.from(set)
  })()
  ```

### Step 4: Verify No Other TypeScript Errors
- Run `npm run build` after applying fixes
- Address any remaining errors (e.g., `remoteFoundAihKeys` might be used elsewhere; check if it's needed)

### Step 5: Test Logic
- Ensure that when a specific hospital is selected and no RD records are found by `hospital_id`, the fallback to CNES query works
- Ensure that the metrics correctly reflect remote AIH count
- Ensure local data does not overwrite remote data (the enrichment logic should only fill missing fields)

## Expected Outcome
- All TypeScript compilation errors resolved
- `cnesVariants` properly declared and used
- `remoteAihFoundCount` no duplicate
- Remote-primary data flow intact
- Build succeeds
