# تصميم نظام إدارة المشرفين - Design Guidelines

## Design Approach
**System-Based Approach**: Dashboard-focused design inspired by Linear and Vercel dashboards, prioritizing clarity, efficiency, and data density. Clean, professional interface optimized for Arabic RTL layout with strong information hierarchy.

## Core Design Principles
1. **Data-First**: Information presented clearly with minimal decoration
2. **Role-Based Views**: Distinct layouts for Super Admin vs Regular Admin
3. **Quick Actions**: Prominent buttons for frequent tasks (check-in/out)
4. **Status Clarity**: Clear visual indicators for attendance, warnings, ratings

## Typography System

**Font Family**:
- Primary: 'Cairo', sans-serif (excellent Arabic support)
- Monospace: 'IBM Plex Mono' (for timestamps, IDs)

**Hierarchy**:
- Page Titles: text-3xl font-bold (32px)
- Section Headers: text-xl font-semibold (20px)
- Card Titles: text-lg font-medium (18px)
- Body Text: text-base (16px)
- Labels/Meta: text-sm text-gray-600 (14px)
- Timestamps: text-xs font-mono (12px)

## Layout System

**Spacing Scale**: Use Tailwind units 2, 4, 6, 8, 12, 16
- Component padding: p-6
- Card spacing: gap-4
- Section margins: mb-8
- Form field spacing: space-y-4

**Container Structure**:
```
Sidebar (fixed): w-64 (Super Admin) / w-20 (Regular Admin collapsed)
Main Content: max-w-7xl mx-auto px-6 py-8
Cards: rounded-lg border shadow-sm p-6
```

## Component Library

### Navigation & Layout
**Sidebar Navigation** (RTL-aware):
- Fixed right-side navigation for Super Admin with full menu
- Collapsed icon-only sidebar for Regular Admin
- Active state: background subtle highlight
- Icons: Heroicons (outline style)

**Top Bar**:
- User profile (right corner with RTL)
- Quick actions (Check-in/out button prominent)
- Current date/time display
- Notification bell icon

### Dashboard Components

**Stats Cards** (Super Admin):
- Grid: grid-cols-1 md:grid-cols-2 lg:grid-cols-4
- Large number display with label
- Icon representation for each metric
- Subtle borders, no heavy shadows

**Attendance Widget** (Regular Admin Priority):
- Prominent check-in/check-out buttons (large, primary action)
- Current status badge (Active/Away/Offline)
- Today's hours worked counter
- Last action timestamp

**Data Tables**:
- Striped rows for readability (bg-gray-50 alternate)
- Sticky header: sticky top-0 bg-white z-10
- Action column (left in RTL)
- Sortable columns with indicators
- Pagination at bottom

**Shift Schedule View**:
- Calendar-style grid or list view toggle
- Color-coded shift types
- Clear time ranges
- Admin name labels

### Forms & Inputs

**Standard Form Pattern**:
- Label above input (text-sm font-medium mb-2)
- Input fields: border rounded-md px-4 py-2
- Focus state: ring-2 ring-blue-500
- Error messages: text-red-600 text-sm mt-1

**Rating Component**:
- Star display (read-only for admin view)
- Numeric score (large, prominent)
- Date and evaluator info
- Comment section with text-gray-700

**Warning/Alert Cards**:
- Warning icon (exclamation triangle)
- Severity level badge (color-coded)
- Date issued
- Description text
- Issued by (Super Admin name)

### Status & Indicators

**Badges**:
- Status: rounded-full px-3 py-1 text-sm
- Present: bg-green-100 text-green-800
- Late: bg-yellow-100 text-yellow-800
- Absent: bg-red-100 text-red-800

**Progress Indicators**:
- Attendance percentage: progress bar with percentage label
- Performance ratings: visual bar chart

## Page-Specific Layouts

### Super Admin Dashboard
- Top row: 4 stat cards (total admins, present today, avg rating, warnings count)
- Main area: Recent attendance table + Recent warnings list (2-column grid)
- Action bar: "Add Admin" + "Create Shift" + "Issue Warning" buttons

### Regular Admin Dashboard
- Hero-style attendance card (large, centered)
- My Schedule section (upcoming shifts)
- My Status summary (attendance %, recent ratings)
- No administrative controls visible

### Attendance Log Page
- Date range filter (top)
- Filterable table (all admins for Super, own records for Regular)
- Export button (Super Admin only)
- Column: Name, Date, Check-in, Check-out, Hours, Status

### Ratings Page
- Filter by admin + date range
- Card-based layout for each rating
- Add rating button (Super Admin) - opens modal form

### Warnings Page
- Filterable list (severity, date, admin)
- Warning cards with full details
- Issue warning button (Super Admin)

## RTL Considerations
- All text alignment: text-right
- Sidebar: fixed right instead of left
- Table action columns: leftmost
- Form layouts: labels and inputs right-aligned
- Icon positions: reversed (chevrons point left for forward navigation)

## Interactive Elements
- Primary buttons: px-6 py-2.5 rounded-md font-medium
- No hover animations on data elements
- Subtle transitions on buttons (transition-colors)
- Click feedback on interactive cards

## Images
**No hero images needed** - This is a data-focused dashboard application. Use icons and data visualizations instead.

**Icons**: Heroicons throughout (check-circle, clock, exclamation-triangle, user-group, calendar, star, etc.)

This design creates a professional, efficient admin management system with clear information hierarchy and role-appropriate interfaces optimized for Arabic users.