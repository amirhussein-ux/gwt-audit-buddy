# Compliance Trend Report - Developer & Technical Documentation

## Component Architecture

### Overview
The Compliance Trend Report (`ComplianceTrendChart.tsx`) is a comprehensive React component that displays compliance performance trends with user-friendly visualizations, KPI indicators, and professional PDF export capabilities.

---

## File Structure

```
src/
├── components/
│   └── dashboard/
│       └── ComplianceTrendChart.tsx      # Main report component (475 lines)
├── utils/
│   └── pdfExport.ts                      # PDF generation utility (220 lines)
└── COMPLIANCE_REPORT_GUIDE.md            # User documentation
```

---

## Component API

### Props
The `ComplianceTrendChart` component accepts no props—it handles all data fetching and state internally.

### Context Dependencies
- `useAuth()` - Retrieves auth token for API calls
- Environment: `VITE_API_URL` - Base API URL configuration

### Data Flow
```
API Query
  ↓
Data Processing (flatten & aggregate scores)
  ↓
Statistics Calculation (current, highest, lowest, trend, insight)
  ↓
Render UI (cards, chart, PDF export)
```

---

## Core Functions

### 1. `getStatusColor(score: number)` 
Returns styling and status text based on compliance score.

```typescript
const getStatusColor = (score: number): { bg: string; text: string; status: string }
```

**Returns:**
- `score >= 80`: Green - 'Excellent'
- `50 <= score < 80`: Yellow - 'Moderate'  
- `score < 50`: Red - 'Needs Improvement'

**Usage in KPI Cards:**
```typescript
const statusInfo = getStatusColor(statistics.current);
<div className={statusInfo.bg}>
  <span className={statusInfo.text}>{statusInfo.status}</span>
</div>
```

---

### 2. `formatDateReadable(dateString: string)`
Converts date to user-friendly format (e.g., "Jan 15, 2026").

```typescript
const formatDateReadable = (dateString: string): string
```

**Implementation:**
```typescript
const date = new Date(dateString);
return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
```

**Used in:**
- Chart X-axis labels
- Tooltip display
- PDF header dates

---

### 3. `calculateStatistics(data: ChartDataPoint[])`
Computes key metrics and auto-generates insights based on trends.

```typescript
const calculateStatistics = (data: ChartDataPoint[]): Statistics
```

**Returns Object:**
```typescript
{
  current: number;        // Latest score
  highest: number;        // Peak score in period
  lowest: number;         // Minimum score in period
  average: number;        // Mean of all scores
  change: number;         // % change from first to last (can be negative)
  trend: 'up' | 'down' | 'stable';
  insight: string;        // Auto-generated English summary
}
```

**Trend Detection Logic:**
```typescript
if (change > 2) trend = 'up';
else if (change < -2) trend = 'down';
else trend = 'stable';
```

**Insight Generation:**
```
if trend === 'up' && change > 10:
  "Strong improvement! Compliance has increased by X%..."
if trend === 'down' && change < -10:
  "Attention needed. Compliance has decreased by X%..."
if trend === 'stable':
  "Stable performance. Scores have remained consistent..."
```

---

## State Management

### Component State
```typescript
const [selectedRange, setSelectedRange] = useState<string>('quarterly');
const [showGuide, setShowGuide] = useState(false);
const chartRef = useRef<HTMLDivElement>(null);
```

| State | Purpose | Default |
|-------|---------|---------|
| `selectedRange` | Active time range filter | `'quarterly'` |
| `showGuide` | Educational guide visibility | `false` |
| `chartRef` | DOM reference for PDF capture | `null` |

### Data Fetching (React Query)
```typescript
const { data, isLoading } = useQuery({
  queryKey: ['compliance-trend', selectedRange],
  queryFn: async () => { /* fetch from API */ },
  enabled: !!token,
})
```

**Query Refetches When:**
- `selectedRange` changes (user clicks different filter)
- User re-authenticates (token changes)

---

## Data Processing

### Raw Data Format
```typescript
interface ComplianceScoreData {
  data: Record<string, Array<{
    _id: string;
    overallScore: number;
    createdAt: string;
  }>>;
  period: string;
}
```

### Processing Pipeline
1. **Flatten:** Extract scores by date from nested agency structure
2. **Aggregate:** Average all agency scores per day
3. **Format:** Add readable date strings to each point
4. **Sort:** chronologically by date
5. **Analyze:** Calculate statistics and trends

```typescript
// Step 1: Group by date
const allScores: Record<string, number[]> = {};
Object.values(data.data).forEach(agencyScores => {
  agencyScores.forEach(score => {
    const date = new Date(score.createdAt).toLocaleDateString();
    if (!allScores[date]) allScores[date] = [];
    allScores[date].push(score.overallScore);
  });
});

// Step 2: Average per day
Object.entries(allScores).forEach(([date, scores]) => {
  const average = scores.reduce((a, b) => a + b, 0) / scores.length;
  chartData.push({ date, average, formatted: formatDateReadable(date) });
});
```

---

## UI Components

### 1. Summary Box
```tsx
<div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
  <p>{statistics.insight}</p>
</div>
```
**Purpose:** Plain-language summary at top of report

---

### 2. KPI Cards Grid
```tsx
<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
  {/* Current, Highest, Lowest, Change */}
</div>
```

**Responsive:** 2 columns on mobile, 4 on desktop

**Card Template:**
```tsx
<div className={`rounded-lg p-4 ${statusInfo.bg}`}>
  <p className="text-xs text-slate-600">{label}</p>
  <p className={`text-2xl font-bold ${statusInfo.text}`}>{value}</p>
  <p className={`text-xs ${statusInfo.text}`}>{status}</p>
</div>
```

---

### 3. Time Range Buttons
```tsx
<div className="flex gap-2 flex-wrap">
  {Object.entries(TIME_RANGES).map(([key, range]) => (
    <Button
      onClick={() => setSelectedRange(key)}
      variant={selectedRange === key ? 'default' : 'outline'}
    >
      {range.label}
    </Button>
  ))}
</div>
```

**Time Ranges Configuration:**
```typescript
const TIME_RANGES: Record<string, TimeRange> = {
  day: { label: 'Last Day', days: 1 },
  monthly: { label: 'Last Month', days: 30 },
  quarterly: { label: 'Last Quarter', days: 90 },
  yearly: { label: 'Last Year', days: 365 },
};
```

---

### 4. Recharts LineChart
```tsx
<ResponsiveContainer width="100%" height={350}>
  <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="formatted" />
    <YAxis domain={[0, 100]} />
    <Tooltip contentStyle={...} />
    <Legend />
    <ReferenceLine y={80} stroke="#22c55e" />
    <ReferenceLine y={50} stroke="#f59e0b" />
    <Line type="monotone" dataKey="average" stroke="#2563eb" />
  </LineChart>
</ResponsiveContainer>
```

**Chart Features:**
- **Reference Lines** at 80% (excellent) and 50% (threshold)
- **Tooltip** shows score % and performance level
- **X-axis** rotates labels if >30 data points
- **Y-axis** shows percentage with label
- **Line** smoothed (monotone interpolation)

---

### 5. Expandable Educational Guide
```tsx
{showGuide && (
  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
    <h4>Understanding Compliance</h4>
    {/* Explanation content */}
  </div>
)}
```

Toggled by "Learn more" button with `setShowGuide(!showGuide)`

---

### 6. Recommendations Box
```tsx
<div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
  <p className="text-xs font-semibold">💡 Recommendation</p>
  <p>{recommendationText}</p>
</div>
```

**Recommendation Logic:**
```
if (current >= 80):
  "Great work! Focus on maintaining..."
else if (current >= 50):
  "Good progress. Prioritize fixing..."
else:
  "Significant opportunity. Consider..."
```

---

## PDF Export

### Function Signature
```typescript
export async function generatePDF(
  element: HTMLElement,
  filename: string,
  metadata?: PDFMetadata
)
```

### Parameters
- **element:** DOM element to capture (chart container)
- **filename:** Output filename (e.g., `compliance-trend-quarterly-2026-04-14.pdf`)
- **metadata:** Optional object with:
  - `period`: Report period label
  - `statistics`: KPI data object
  - `insight`: Summary text

### PDF Structure

**Page 1:** Title & KPIs
```
[Title] Compliance Trend Report
[Metadata] Period: Last Quarter | Generated: April 14, 2026
[Executive Summary] Insight text
[KPI Cards] 4 color-coded metrics
[Legend] Color scale explanation
[Recommendations] Auto-generated guidance
```

**Page 2+:** Chart
```
[Chart Title] Performance Trend
[Chart Image] Responsive-rendered Recharts visualization
[Footer] Page numbers
```

### Implementation Details

**Dynamic Imports (Vite-Compatible):**
```typescript
const jsPDFModule = await import('jspdf');
const html2canvasModule = await import('html2canvas');
```
⚠️ **Critical:** Must use string literals, not variables. This allows Vite's static analyzer to resolve at build time.

**Chart Rendering Delay:**
```typescript
await new Promise(resolve => setTimeout(resolve, 500));
```
Ensures LineChart animation completes before screenshot.

**Color Conversion Utility:**
```typescript
function hexToRgb(hex: string): [number, number, number]
```
Converts hex colors to RGB tuples for jsPDF.

---

## Styling

### Tailwind Classes Used
- **Cards:** `rounded-lg p-4 bg-*-50 border border-*-200`
- **Text:** `text-*-700`, `text-2xl font-bold`
- **Grid:** `grid grid-cols-2 md:grid-cols-4 gap-3`
- **Flexbox:** `flex gap-2 flex-wrap items-center justify-between`
- **Colors:** Blue (primary), Green (excellent), Yellow (moderate), Red (needs work)

### Color System
```
Primary Blue:    #2563eb (text-blue-600, element-blue-50)
Success Green:   #22c55e (score >= 80)
Warning Yellow:  #eab308 (50 <= score < 80)
Error Red:       #ef4444 (score < 50)
Neutral:         #64748b gray tones (slate-*)
```

---

## Performance Considerations

### Query Optimization
- Query key includes `selectedRange` → refetches only when needed
- Conditional fetching: `enabled: !!token` prevents unnecessary requests
- TanStack Query handles caching automatically

### Rendering Optimization
- `chartRef` prevents chart re-renders via direct DOM reference
- Memoization opportunities: Consider `useMemo()` for statistics if processing large datasets
- Recharts optimizes line interpolation natively

### PDF Generation Performance
- 500ms delay is necessary for chart render
- `html2canvas` with `scale: 2` for crisp images (may impact performance)
- Consider reducing scale to 1.5 if PDFs are 10MB+

---

## Common Customizations

### Adjusting Score Thresholds
Located in `getStatusColor()` function:
```typescript
if (score >= 80) // Change threshold here
  return { bg: 'bg-green-50', text: 'text-green-700', status: 'Excellent' };
```

### Adding New Time Ranges
Update `TIME_RANGES`:
```typescript
const TIME_RANGES = {
  day: { label: 'Last Day', days: 1 },
  week: { label: 'Last Week', days: 7 }, // NEW
  monthly: { label: 'Last Month', days: 30 },
  // ...
};
```

### Changing Chart Height
Update ResponsiveContainer:
```tsx
<ResponsiveContainer width="100%" height={350}> {/* Change 350 */}
```

### Customizing PDF Appearance
In `pdfExport.ts`:
```typescript
pdf.setFontSize(22);               // Adjust title size
pdf.setTextColor(37, 99, 235);     // Adjust colors
// Modify layout spacing with yPosition increments
```

---

## Error Handling

### API Fetch Errors
```typescript
if (!response.ok) throw new Error('Failed to fetch compliance trend');
```
→ Query displays empty state

### PDF Generation Errors
```typescript
try {
  await generatePDF(...)
} catch (error) {
  console.error('Error downloading PDF:', error);
  alert('Failed to export PDF. Please try again.');
}
```

### Missing Data
```typescript
if (chartData.length > 0) {
  // Render chart
} else {
  // Show "No data available" message
}
```

---

## Testing Checklist

- [ ] Chart displays data for all 4 time ranges
- [ ] Statistics calculate correctly (verify manually against data)
- [ ] Insights change based on trend direction
- [ ] KPI cards display correct colors based on score
- [ ] PDF exports without errors
- [ ] PDF includes title, summary, KPIs, and chart
- [ ] Responsive layout works on mobile (2 columns)
- [ ] Responsive layout works on desktop (4 columns)
- [ ] Date formatting shows "Jan 15, 2026" format
- [ ] Guide expands/collapses correctly
- [ ] Recommendations change based on score tier

---

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | 18.3.1 | UI framework |
| `recharts` | Latest | Line chart visualization |
| `jspdf` | 2.5.1 | PDF generation |
| `html2canvas` | 1.4.1 | HTML to image capture |
| `@tanstack/react-query` | Latest | Data fetching & caching |
| `lucide-react` | Latest | Icons (Download, TrendingUp, etc.) |
| `shadcn/ui` | Latest | Card, Button components |

---

## Future Enhancements

1. **Agency-Level Filtering**
   - Allow users to view specific agency trends
   - Compare multiple agencies on same chart

2. **Predictive Insights**
   - Forecast future scores based on trend
   - Recommend when next audit should occur

3. **Export Formats**
   - CSV export for data analysis
   - Excel with graphs
   - Google Sheets integration

4. **Drill-Down Analysis**
   - Click on chart to see agency breakdown
   - View individual check scores
   - Link to specific audit details

5. **Benchmarking**
   - Compare against state/national average
   - Industry best practices
   - Historical targets

---

## Troubleshooting

### Chart Not Showing
- Verify API is returning data
- Check browser console for fetch errors
- Ensure auth token is valid

### PDF Is Blank
- Increase 500ms delay in pdfExport.ts
- Check that chart is fully rendered before export
- Verify html2canvas dependencies are installed

### Wrong Data Displayed
- Clear React Query cache (dev tools)
- Verify selectedRange state is updating
- Check API endpoint returns correct period-scoped data

### Styling Issues
- Ensure Tailwind CSS is compiled
- Check that shadcn/ui components are installed
- Verify Tailwind config includes component paths

---

**Last Updated:** April 2026  
**Component Type:** Dashboard Report  
**Framework:** React 18 + TypeScript  
**UI Library:** Shadcn/UI + Recharts
