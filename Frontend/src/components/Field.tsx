import type { FormEvent, InputHTMLAttributes, SelectHTMLAttributes } from 'react'

export function RequiredFieldsNotice() {
  return <p className="rounded-lg border border-primary-light/60 bg-background/60 px-3 py-2 text-xs font-medium text-slate-600">Los campos marcados con <strong>*</strong> son obligatorios.</p>
}

export function showRequiredFieldMessage(event: FormEvent<HTMLFormElement>) {
  const fields = Array.from(event.currentTarget.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input[required], select[required]'))
  const field = fields.find(candidate => candidate.validity.valueMissing)
  if (!field) return
  fields.forEach(candidate => candidate.setCustomValidity(''))
  event.preventDefault()
  const message = requiredFieldMessage(field)
  field.setCustomValidity(message)
  field.reportValidity()
}

export function requiredFieldMessage(field: HTMLInputElement | HTMLSelectElement) {
  const label = field.closest('label')?.textContent?.replace('*', '').trim() || 'obligatorio'
  return `Falta por llenar el campo «${label}».`
}

const clearFieldMessage = (event: FormEvent<HTMLInputElement | HTMLSelectElement>) => {
  event.currentTarget.setCustomValidity('')
}

export function Field({ label, onInput, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) { return <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-ink">{label}<input {...props} onInput={event => { clearFieldMessage(event); onInput?.(event) }} className="w-full min-w-0 rounded-lg border border-border bg-white px-3 py-2.5 font-normal outline-none transition placeholder:text-slate-300 focus:border-primary-dark focus:ring-2 focus:ring-primary/15" /></label> }
export function SelectField({ label, children, onInput, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) { return <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-ink">{label}<select {...props} onInput={event => { clearFieldMessage(event); onInput?.(event) }} className="w-full min-w-0 rounded-lg border border-border bg-white px-3 py-2.5 font-normal outline-none focus:border-primary-dark focus:ring-2 focus:ring-primary/15">{children}</select></label> }
