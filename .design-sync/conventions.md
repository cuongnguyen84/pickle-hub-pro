## ThePickleHub UI — how to build with this design system

A **dark-premium** React component set (shadcn/ui + Radix primitives) styled with **Tailwind utility classes bound to CSS-variable tokens**. The theme is dark by default — tokens live at `:root`, there is no light mode and no theme toggle. Build on dark surfaces; never assume a white page.

### Setup

- Link the design system's `styles.css` once. It carries the tokens, the Tailwind utility layer, the brand fonts (Inter for text, JetBrains Mono for scores/numbers), and the component CSS. Everything below resolves through it.
- Most components are self-contained — just render them. Three need a wrapper:
  - **Tooltip** → wrap in `<TooltipProvider>` (once, near the root), then `<Tooltip><TooltipTrigger/><TooltipContent/></Tooltip>`.
  - **Toast** → wrap in `<ToastProvider>` and render one `<ToastViewport/>` at the root; emit `<Toast>` items inside.
  - **Form** → driven by `react-hook-form`: `const form = useForm()`, then `<Form {...form}><FormField control={form.control} … /></Form>`.
- Compound components compose explicit parts: `Card` + `CardHeader`/`CardTitle`/`CardContent`/`CardFooter`; `Select` + `SelectTrigger`/`SelectContent`/`SelectItem`; `Dialog`/`Sheet`/`Drawer` + their `*Content`/`*Header`/`*Footer`. All parts are importable from the package root even though only the 31 top-level components have their own cards.

### Styling idiom — utility classes on semantic tokens

Style with Tailwind classes that reference tokens, NOT raw colors. Stay on this vocabulary so output matches the brand:

| Purpose | Classes |
|---|---|
| Page / surfaces | `bg-background` · `bg-card` · `bg-popover` · `bg-muted` · `bg-secondary` · `bg-accent` |
| Text | `text-foreground` · `text-muted-foreground` · `text-card-foreground` |
| Accent (teal) | `bg-primary` `text-primary-foreground` · `text-primary` |
| Danger / live | `bg-destructive` `text-destructive-foreground` · `text-destructive` |
| Borders | `border` · `border-input` · `border-border` |
| Radius | `rounded-md` · `rounded-lg` (from `--radius`) |

Component variants are props, not classes: `Button`/`Badge` take `variant` (`default`/`secondary`/`outline`/`destructive`/`ghost`/`link`) and `size`; `Alert`/`Toggle` take `variant`. Pass extra layout with `className` (Tailwind). Numeric/score UI should use the mono family (`font-mono`).

### Where the truth lives

- Read the bound `styles.css` (and its `@import`ed tokens) for the exact token values before inventing colors.
- Per component: its `*.d.ts` is the prop contract; its `*.prompt.md` shows usage. Read those before composing a component you haven't used.

### Idiomatic snippet

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button, Badge } from "<package>";

<div className="bg-background text-foreground p-6">
  <Card className="max-w-sm">
    <CardHeader>
      <div className="flex items-center justify-between">
        <CardTitle>Summer Slam 2026</CardTitle>
        <Badge>LIVE</Badge>
      </div>
      <CardDescription>Outdoor · Mixed Doubles · 4.0–4.5</CardDescription>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground">64 teams · Double elimination · Prize pool $2,400.</p>
    </CardContent>
    <CardFooter className="gap-3">
      <Button>Register</Button>
      <Button variant="outline">Details</Button>
    </CardFooter>
  </Card>
</div>
```
