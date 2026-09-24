import type { FormEvent, InputHTMLAttributes, SelectHTMLAttributes } from 'react'

export function RequiredFieldsNotice() {
  return <p className="text-xs font-medium text-slate-500">Los campos marcados con * son obligatorios.</p>
}

export function showRequiredFieldMessage(event: FormEvent<HTMLFormElement>) {
  const fields = Array.from(event.currentTarget.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input[required], select[required]'))
  const field = fields.find(candidate => candidate.validity.valueMissing)
  if (!field) return
  fields.forEach(candidate => candidate.setCustomValidity(''))
  event.preventDefault()
  const label = field.closest('label')?.textContent?.replace('*', '').trim() || 'obligatorio'
  field.setCustomValidity(`Falta por llenar el campo «${label}».`)
  field.reportValidity()
}

const clearFieldMessage = (event: FormEvent<HTMLInputElement | HTMLSelectElement>) => {
  event.currentTarget.setCustomValidity('')
}

export function Field({ label, onInput, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) { return <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-ink">{label}<input {...props} onInput={event => { clearFieldMessage(event); onInput?.(event) }} className="w-full min-w-0 rounded-lg border border-border bg-white px-3 py-2.5 font-normal outline-none transition placeholder:text-slate-300 focus:border-primary-dark focus:ring-2 focus:ring-primary/15" /></label> }
export function SelectField({ label, children, onInput, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) { return <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-ink">{label}<select {...props} onInput={event => { clearFieldMessage(event); onInput?.(event) }} className="w-full min-w-0 rounded-lg border border-border bg-white px-3 py-2.5 font-normal outline-none focus:border-primary-dark focus:ring-2 focus:ring-primary/15">{children}</select></label> }
