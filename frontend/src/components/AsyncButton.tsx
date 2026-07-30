import { Button, ButtonProps } from '@mantine/core'
import { useAsyncAction } from '../lib/useAsyncAction'

interface Props extends ButtonProps {
  onClick: () => Promise<void>
  errorTitle?: string
  disabled?: boolean
}

// A Button whose onClick is an async action: disabled and showing a spinner
// for the duration of its own in-flight call, and reporting failure through
// the shared error-notification path. See useAsyncAction for the guard this
// builds on.
export default function AsyncButton({ onClick, errorTitle, disabled, ...buttonProps }: Props) {
  const action = useAsyncAction(onClick, errorTitle)

  return (
    <Button
      {...buttonProps}
      disabled={disabled || action.pending}
      loading={action.pending}
      onClick={action.run}
    />
  )
}
