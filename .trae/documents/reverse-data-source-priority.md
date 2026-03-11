# Plan: Reverse Data Source Priority - Remote Primary, Local Supplement

## Current Logic (Local Primary)
1. Fetch local `gsus_aihs_patients` records based on filters
2. Fetch remote `sih_rd` and `sih_sp` records
3. Merge: Local records are the base, remote data fills gaps
4. Report includes all local records, enriched with remote data where available
5. Metrics show: "AIHs no SIH (encontradas)", "AIHs no local (preenchidas)", "AIHs não encontradas no SIH"

## Desired Logic (Remote Primary)
1. **Start with remote SIH data** as the base/authoritative source
2. Use local database **only to supplement** missing information:
   - Patient names (`patient_name`)
   - Prontuário (`prontuario`)
   - Possibly other fields
3. Report should include **only AIHs that exist in remote SIH**
4. Local-only records (not found in remote) should be **excluded** from the report
5. Metrics should reflect: remote as source, local as enrichment

## Implementation Steps

### 1. Reorder Data Fetching
- **First**: Fetch remote `sih_rd` and `sih_sp` records (with all filters)
- **Second**: Fetch local `gsus_aihs_patients` records (only for AIHs found in remote)
- This ensures remote defines the scope

### 2. Change the Combined Set Logic
**Current** (line 868):
```typescript
const combinedAihKeys = Array.from(new Set([...Array.from(uniqueLocalByAih.keys()), ...remoteRdAihKeys]))
```
**New**:
```typescript
const combinedAihKeys = Array.from(new Set(remoteRdAihKeys)) // Only remote AIHs
```
Local records should only be used to **enrich** remote records, not to add new ones.

### 3. Modify Enrichment Logic
**Current**: Enrichment fetches from local `gsus_aihs_patients` for local records that lack data
**New**: Enrichment should fetch from local `gsus_aihs_patients` for **remote AIHs** that lack patient/prontuario info

Change lines 906-962:
- `needsEnrichKeys` should be remote AIHs that are missing patient name or prontuario
- Query local `gsus_aihs_patients` using AIH numbers from remote set
- Merge local data into `reportEntries` to fill gaps

### 4. Remove Local-Only Entries
**Current**: Lines 887-898 add local rows without AIH numbers
**New**: Remove this section entirely. Only remote AIHs should appear in the report.

### 5. Update Metrics/Info Object
Lines 1229-1240 create the `info` object. Update metrics:
- `remoteAihFoundCount`: Count of remote AIHs (already exists)
- `localAihFilledCount`: Count of remote AIHs that had local enrichment data
- `missingInRemoteCount`: Should be 0 (since we only include remote AIHs)
- `localNoAihCount`: May be irrelevant or 0
- Add new metric: `localEnrichmentRate` = percentage of remote AIHs enriched with local data

### 6. Update Report Rows Construction
Lines 1051-1200 build `rowsDetailed`. Ensure:
- Every entry has an AIH from remote
- Patient name/prontuario comes from local if available, otherwise from remote (or blank)
- The logic should prioritize local data for enrichment but **must have remote AIH**

### 7. Update Fixed Payment Rows
Lines 1202-1225 add fixed payment rows for doctors. These are based on `totalsByDoctorHospital` which is built from `reportEntries`. This should still work as long as `reportEntries` are based on remote AIHs.

### 8. Update Summary Info Display
In PDF/Excel metadata, update labels to reflect new reality:
- "AIHs no SIH (encontradas)" → "AIHs no SIH (base do relatório)"
- "AIHs no local (preenchidas)" → "AIHs enriquecidas com dados locais"
- "AIHs não encontradas no SIH" → remove or show as 0
- "Registros locais sem nº AIH" → remove or show as 0

### 9. Update Sorting Logic (if needed)
Current sorting (lines 1242-1258) prioritizes remote AIHs. This should still be fine, but we may simplify since all entries will be remote.

### 10. Test and Verify
- Ensure no local-only records appear in report
- Verify that patient names/prontuarios are pulled from local when available
- Check that metrics accurately reflect the data flow
- Build and test for TypeScript errors

## Expected Outcome
- Report includes **only AIHs that exist in remote SIH database**
- Local database is used solely to **enrich** remote records with additional patient/prontuario info
- Metrics clearly show how many remote AIHs were enriched with local data
- No "local-only" rows appear in the report
- The component name "Fonte Híbrida" still makes sense because it uses both sources, but remote is authoritative

## Risks
- Some remote AIHs may not have local records → patient names may be blank
- Need to ensure the enrichment query is efficient (batch queries)
- May need to handle cases where local data conflicts with remote (use local for enrichment only, not to override remote core fields)
