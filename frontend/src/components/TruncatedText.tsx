import { useRef } from 'react'
import { Text, TextProps, Tooltip } from '@mantine/core'
import { useIsTruncated } from '../lib/useIsTruncated'

interface Props extends Omit<TextProps, 'children' | 'truncate'> {
  children: React.ReactNode
  label: string
}

// Renders children as truncating text, showing a tooltip with label only
// once the text is actually clipped - same technique as ClippedPath.tsx.
// label is separate from children since children may include a decorative
// prefix (e.g. an icon) that shouldn't appear in the tooltip.
export default function TruncatedText({ children, label, ...textProps }: Props) {
  const ref = useRef<HTMLParagraphElement>(null)
  const truncated = useIsTruncated(ref, label)

  const text = (
    <Text ref={ref} truncate="end" {...textProps}>
      {children}
    </Text>
  )

  return truncated ? <Tooltip label={label} openDelay={500}>{text}</Tooltip> : text
}
