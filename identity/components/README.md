# Pre-configured Standard UI Components

This folder contains the complete, pre-configured baseline of standard UI components for the identity domain, built on top of the specifications defined in our [client style guide](../../guides/client/typescript/STYLE_GUIDE.md).

These components are designed to be **vendored** directly into downstream projects (not added as live npm library dependencies), enabling teams to fully own and fine-tune their primitive styling while maintaining a strong baseline.

## Included Components

- **`Button`**: Flexible, variant-driven button primitive using Class Variance Authority (CVA).
- **`Input`**: Controlled/uncontrolled styling-extended text input.
- **`Label`**: Robust label primitive supporting peer focus and disabled state triggers, built on `@radix-ui/react-label`.
- **`Checkbox`**: Accessible check control, built on `@radix-ui/react-checkbox`.
- **`Dialog`**: Modal overlay and focus-trapped dialog layouts, built on `@radix-ui/react-dialog`.
- **`DropdownMenu`**: Popover utility and custom item/sub-menus, built on `@radix-ui/react-dropdown-menu`.
- **`Card`**: Highly composable layout container for sections, headers, descriptions, content, and footers.
- **`utils`**: The canonical `cn(...)` class-merging helper using `clsx` and `tailwind-merge`.

## Prerequisites & Dependencies

To support these components, make sure the downstream repository installs the following npm dependencies:

```bash
# Style utilities
pnpm add class-variance-authority clsx tailwind-merge

# Radix UI primitives
pnpm add @radix-ui/react-label @radix-ui/react-checkbox @radix-ui/react-dialog @radix-ui/react-dropdown-menu
```

## TailwindCSS & CSS Variables Setup

Ensure your Tailwind styling is loaded with CSS variables matching the expected system tokens. Your global CSS stylesheet (e.g., `src/index.css`) should define:

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
  }
}
```

## Synchronization

These components are managed and kept up-to-date using the `dotfiles sync-components` command. Refer to the root `README.md` or scripts section for CLI instructions.
