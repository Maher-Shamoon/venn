import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/* Variants follow the measured ramp.com buttons: 400 weight, 6-8px radius, 0.3s colour transitions,
   black primary, neon accent, soft grey secondary. */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 border border-transparent font-normal whitespace-nowrap transition-colors duration-300 ease-[var(--ease-ramp)] outline-none select-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-[#3a3837]",
        destructive: "bg-[#c2410c] text-white hover:bg-[#9a3412] disabled:opacity-50",
        lime: "bg-lime text-foreground hover:bg-lime-light",
        outline: "border-border bg-background text-foreground hover:bg-muted",
        secondary: "bg-muted text-foreground hover:bg-gray-medium/60",
        ghost: "text-foreground hover:bg-muted",
        link: "text-foreground underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 rounded-md px-3.5 text-sm",
        sm: "h-8 rounded-md px-3 text-sm",
        lg: "h-12 rounded-lg px-5 text-base",
        icon: "size-10 rounded-md",
        "icon-sm": "size-8 rounded-md",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      nativeButton={props.render ? false : undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
