
import React from "react";

type OwnProps = object;

type Attributes = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  keyof OwnProps
>;

export type InputProps = OwnProps & Attributes;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { type = "text", ...props }
    , ref
  ) => <input type={type} ref={ref} {...props} />
)


