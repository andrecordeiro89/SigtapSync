# Plan: Fix "A spread argument must either have a tuple type or be passed to a rest parameter" Errors

## Problem Description
TypeScript error: "A spread argument must either have a tuple type or be passed to a rest parameter."
This occurs when using the spread operator (`...`) on a value that TypeScript cannot guarantee is an array or tuple.

## Common Causes in This File
Looking at the grep results, the errors likely occur in these contexts:

1. **autoTable color properties** (lines 418, 427, 433, 439, 443):
   ```typescript
   fillColor: [...colors.primary]
   textColor: [...colors.text]
   ```
   Here `colors.primary` is already an array `[10, 92, 54]`. Spreading it creates a new array, but TypeScript may infer the type incorrectly.

2. **XLSX array spreading** (line 523):
   ```typescript
   XLSX.utils.aoa_to_sheet([['Mês', 'Qtd AIHs', 'Valor Total'], ...tableBody])
   ```
   `tableBody` might have an ambiguous type.

3. **Array spreads in JSX** (lines 846, 864, 922):
   ```typescript
   [...availableCompetencias]
   [...prev, c]
   [...prev, String(m)]
   ```
   These are likely fine as they spread into array literals.

## Solution Approach

### For autoTable color arrays:
Instead of:
```typescript
fillColor: [...colors.primary]
```
Use:
```typescript
fillColor: colors.primary as [number, number, number]
```
Or simply:
```typescript
fillColor: colors.primary
```
Since it's already an array, no need to spread.

### For XLSX tableBody:
Ensure `tableBody` is typed as a tuple or explicitly cast:
```typescript
const tableBody: [string, string, string][] = hospitalRows.map(...)
```
Or use `as const` assertion.

### For general array spreads:
Ensure the source is explicitly typed as an array:
```typescript
[...(availableCompetencias as string[])]
```

## Implementation Steps

1. **Identify all problematic spread operators** - Already done via grep
2. **Fix autoTable color spreads** - Remove the spread operator, use the array directly, or add type assertion
3. **Fix XLSX tableBody** - Add explicit type annotation
4. **Fix any other spreads** - Add type assertions where needed
5. **Run build** to verify errors are resolved

## Expected Outcome
- No TypeScript compilation errors
- All spread operators have proper type information
- Build succeeds cleanly
