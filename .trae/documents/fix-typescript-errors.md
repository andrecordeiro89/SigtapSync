# Plan: Fix TypeScript Errors in ApprovedByCompetenceDialog

## Problem
The `SummaryRow` interface is defined locally inside the `handleGenerateReport` function (line 647), but it's referenced in the type signatures of `savePdfReportDirect` and `saveExcelReportDirect` functions which are defined at the module level. This causes TypeScript compilation errors because the type is out of scope.

## Current Structure
```typescript
// savePdfReportDirect and saveExcelReportDirect are defined here (module scope)
// They reference SummaryRow in their parameters

const savePdfReportDirect = (summaryData: SummaryRow[], ...) => { ... }

const saveExcelReportDirect = (summaryData: SummaryRow[], ...) => { ... }

export default function ApprovedByCompetenceDialog(...) {
  const handleGenerateReport = async (...) => {
    // SummaryRow is defined HERE (inside this function)
    interface SummaryRow {
      hospitalId: string;
      hospitalName: string;
      month: number;
      year: number;
      aihCount: number;
      totalValue: number;
    }
    // ...
  }
}
```

## Solution
Move the `SummaryRow` interface definition to module scope (top level) so it's accessible to all functions in the file.

### Steps:
1. Cut the `interface SummaryRow` definition from inside `handleGenerateReport` (around line 647-654)
2. Paste it at the top level of the module, after imports and before any functions
3. Ensure all properties match: `hospitalId`, `hospitalName`, `month`, `year`, `aihCount`, `totalValue`
4. Verify that the build completes without TypeScript errors

## Additional Checks
- Ensure there are no other local type references that need to be moved
- Verify that all functions using SummaryRow have access to it
- Run build to confirm no TypeScript errors remain
