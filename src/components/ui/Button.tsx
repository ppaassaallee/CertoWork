import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

const buttonVariants = cva("cw-btn", {
  variants: {
    variant: {
      primary: "cw-btn-primary",
      secondary: "cw-btn-secondary",
      ghost: "cw-btn-ghost",
      destructive: "cw-btn-destructive",
    },
    size: {
      sm: "cw-btn-sm",
      md: "cw-btn-md",
    },
  },
  defaultVariants: {
    variant: "secondary",
    size: "md",
  },
});

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export function Button({
  className,
  variant,
  size,
  asChild = false,
  type = "button",
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={buttonVariants({ variant, size, className })}
      type={asChild ? undefined : type}
      {...props}
    />
  );
}

export { buttonVariants };
