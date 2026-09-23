import Swal from 'sweetalert2'

const psicoArteAlert = Swal.mixin({
  confirmButtonColor: '#087A18',
  cancelButtonColor: '#C51F24',
  color: '#263238',
  customClass: {
    popup: 'rounded-2xl',
    confirmButton: 'rounded-lg',
    cancelButton: 'rounded-lg',
  },
})

export async function confirmAction(title: string, text: string) {
  const result = await psicoArteAlert.fire({
    title,
    text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, continuar',
    cancelButtonText: 'Cancelar',
    reverseButtons: true,
  })

  return result.isConfirmed
}

export function showSuccess(title: string, text: string) {
  return psicoArteAlert.fire({
    title,
    text,
    icon: 'success',
    timer: 1800,
    showConfirmButton: false,
  })
}

export function showError(title: string, text: string) {
  return psicoArteAlert.fire({
    title,
    text,
    icon: 'error',
    confirmButtonText: 'Entendido',
  })
}
