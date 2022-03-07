import { FieldError } from "react-hook-form"
import { ExecutionResult } from "graphql"
import { IToastProps, useToast } from "native-base"

export interface ValidationError {
  property: string
  constraints: { [key: string]: string }
}

export function formatValidations(errors: ValidationError[]): FieldError[] {
  return errors.map((error) => ({
    name: error.property,
    type: error.property,
    types: error.constraints,
  }))
}

export interface MutationHandler<T> {
  onSuccess?: (data: NonNullable<T>, toast: (props: IToastProps) => void) => Promise<any> | any
  onValidationError?: (errors: FieldError[], toast: (props: IToastProps) => void) => Promise<any> | any
  onAppError?: (message: string, toast: (props: IToastProps) => void) => Promise<any> | any
  onServerError?: (message: string, toast: (props: IToastProps) => void) => Promise<any> | any
  onFinish?: (toast: (props: IToastProps) => void) => Promise<any> | any
}

async function mutationHandler<T>(
  res: ExecutionResult<NonNullable<T>> | void,
  handler: MutationHandler<T>,
  toast: (props: IToastProps) => void,
  actions?: {
    setFieldErrors: (errors: FieldError[]) => void
    setAppError: (message: any) => void
  },
) {
  try {
    if (!res) throw new Error("No response")
    if (res.data && !res.errors) {
      if (handler.onSuccess) {
        await handler.onSuccess(res.data, toast)
      }
    } else if (
      res.errors?.[0].message.includes("Access denied!") ||
      res.errors?.[0].message.includes("Not authorized")
    ) {
      toast({
        w: "300px",
        placement: "top",
        status: "error",
        title: "You are not authorized to perform this action.",
      })
    } else if (res.errors?.[0].message.includes("Not authenticated")) {
      toast({
        w: "300px",
        placement: "top",
        status: "error",
        title: "Please login to continue.",
      })
    } else if (res.errors?.[0].extensions?.exception?.validationErrors) {
      const validationErrors = res.errors?.[0].extensions?.exception?.validationErrors
      if (handler.onValidationError) {
        await handler.onValidationError(formatValidations(validationErrors), toast)
      } else if (actions) {
        actions.setFieldErrors(formatValidations(validationErrors))
      }
    } else if (res.errors?.[0].extensions?.code === "BAD_USER_INPUT") {
      if (handler.onAppError) {
        await handler.onAppError(res.errors[0].message, toast)
      } else {
        toast({
          placement: "top",
          w: "300px",
          status: "error",
          title: res.errors[0].message,
        })
      }
    } else if (res.errors?.[0].message) {
      if (handler.onServerError) {
        await handler.onServerError(res.errors[0].message, toast)
      } else {
        toast({
          w: "300px",
          placement: "top",
          status: "error",
          title: "Server error. We have been notified.",
        })
      }
    }
  } catch (e) {
    console.log(e)
    toast({
      w: "300px",
      placement: "top",
      status: "error",
      title: "Server error. We have been notified.",
    })
  } finally {
    if (handler?.onFinish) {
      await handler.onFinish(toast)
    }
    return res
  }
}

export function useMutationHandler() {
  const toast = useToast()
  async function handle<T>(
    mutation: () => Promise<ExecutionResult<NonNullable<T>> | void>,
    actions?: MutationHandler<T>,
    formActions?: {
      setFieldErrors: (errors: FieldError[]) => void
      setAppError: (message: any) => void
    },
  ) {
    try {
      const res = await mutation()
      return mutationHandler(res, actions || {}, toast.show, formActions)
    } catch (e) {
      console.log("Oops", e)
      toast.show({
        w: "300px",
        placement: "top",
        title: "Something went wrong. We have been notified!",
        status: "error",
      })
      return
    }
  }
  return handle
}