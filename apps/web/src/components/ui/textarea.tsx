import * as React from 'react'

import { fieldControlClass } from '@/lib/field-styles'
import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        fieldControlClass,
        'field-sizing-content flex min-h-16 py-2',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
