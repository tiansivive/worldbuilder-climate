
import React from "react";



type OwnProps = object;

type Attributes = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  keyof OwnProps
>;

export type TextInputProps = OwnProps & Attributes;

export const TextInput =

  React.forwardRef<HTMLInputElement, TextInputProps>(
    (
      {

        type = "text",
        ...props
      },
      ref
    ) => <input
        type={type}
        ref={ref}
        {...props}
      />
  )


