# Candidate UI — Design Notes & Assumptions

## Assumptions

| # | Area | Assumption | Rationale |
|---|------|-----------|-----------|
| 1 | **Font** | Plus Jakarta Sans (via existing app config) | Deployed site uses this font |
| 2 | **Logo** | Custom SVG leaf/wing icon | Approximation of the AIHire logo from screenshots |
| 3 | **Sidebar width** | 200px | Matches screenshot proportions |
| 4 | **User avatar** | Initials "SC" in circle | No real avatar image; consistent with screenshot |
| 5 | **Port routing** | Candidate app on port 3001, recruiter on 3000 | Standard Next.js dev convention |
| 6 | **Dashboard cards** | 4 summary cards with mock data | Values match screenshot exactly (12, 0%, 4, 0) |
| 7 | **Pipeline chart** | SVG donut with 0 counts | Screenshot shows empty pipeline state |
| 8 | **Quick Stats** | 4 stat items matching screenshot layout | Applications active, interviews, offers, actions |
| 9 | **Highlighted card** | "New Role Matches" uses `bg-primary` | Green background matches screenshot |
| 10 | **Card icons** | Lucide `ExternalLink` arrow icon | Screenshot shows small arrow icons on cards |

## Design Tokens Used (from globals.css)

- `--primary: #2d6a4f` — Dark green (CTAs, active nav, highlighted card)
- `--primary-foreground: #ffffff` — White text on green
- `--background: #f6f7f5` — Light green-tinted canvas
- `--card: #ffffff` — White card surfaces
- `--border: #d4ddd2` — Subtle green-tinted borders
- `--sidebar-bg: #f0f4ee` — Sidebar background
- `--muted-foreground: #5c6b5c` — Secondary text

## Screens Implemented

- [x] Screen 1: Welcome / Role Selection — wired up Candidate card (was "Coming Soon")
- [x] Screen 2: Candidate Dashboard — sidebar, topbar, summary cards, pipeline, quick stats
- [ ] Screen 3: Role Matches — next to implement

## Open Questions

1. Should the candidate app share the same Clerk instance as the recruiter app?
2. Pipeline chart: should it use Recharts or a custom SVG? (Currently custom SVG)
3. Mobile responsive breakpoints: 768px? 640px?
