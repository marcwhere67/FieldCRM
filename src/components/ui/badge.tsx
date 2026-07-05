import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-none border border-transparent px-2 py-0.5 text-[10px] font-normal tracking-[0.08em] uppercase whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default:    "bg-[#2C3E50] text-white",
        secondary:  "bg-[#EDE8E2] text-[#4A5A65]",
        sage:       "bg-[rgba(118,165,143,0.12)] text-[#5d8c76] border-[rgba(118,165,143,0.3)]",
        navy:       "bg-[rgba(44,62,80,0.08)] text-[#2C3E50] border-[rgba(44,62,80,0.15)]",
        amber:      "bg-[rgba(217,119,6,0.08)] text-[#b45309] border-[rgba(217,119,6,0.2)]",
        red:        "bg-[rgba(220,38,38,0.08)] text-[#dc2626] border-[rgba(220,38,38,0.2)]",
        blue:       "bg-[rgba(37,99,235,0.08)] text-[#2563eb] border-[rgba(37,99,235,0.2)]",
        purple:     "bg-[rgba(124,58,237,0.08)] text-[#7c3aed] border-[rgba(124,58,237,0.2)]",
        destructive: "bg-[rgba(220,38,38,0.08)] text-[#dc2626] border-[rgba(220,38,38,0.2)]",
        outline:    "border-border text-foreground",
        ghost:      "hover:bg-muted hover:text-muted-foreground",
        link:       "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
