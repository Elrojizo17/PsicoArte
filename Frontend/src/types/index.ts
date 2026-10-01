export interface Acudiente {
  numero_documento: string
  nombre_1: string
  nombre_2?: string
  apellido_1: string
  apellido_2?: string
  tipo_documento: string
  correo?: string
  telefono_1: string
  telefono_2?: string
  telefono_3?: string
  alumnos?: AlumnoSummary[]
  usuario_username?: string | null
}

export interface AlumnoSummary { ti: string; nombre_1: string; apellido_1: string }
export interface ClaseSummary { id_clase: number; fecha: string; jornada: number }

export interface Alumno {
  ti: string
  nombre_1: string
  nombre_2?: string
  apellido_1: string
  apellido_2?: string
  identificacion?: string | null
  tipo_sangre?: string
  eps?: string
  numero_documento_acudiente?: string
  acudiente_detalle?: Acudiente
  fecha_nacimiento?: string | null
  clases?: ClaseSummary[]
  pagos?: Pago[]
  resumen_pagos?: ResumenPagos
}

export interface Pago { id_pago: number; alumno: string; fecha_pago: string; clases_pagadas: number; valor_pagado: string; clases_consumidas: string[]; clases_cubiertas: string[]; clases_disponibles: number; fecha_cubre_hasta: string | null }
export interface ResumenPagos { clases_pagadas: number; clases_impartidas: number; clases_disponibles: number; estado_pago: 'sin_pago' | 'vigente' | 'vencido'; fecha_ultimo_pago: string | null; fecha_proximo_pago: string | null; fecha_cubre_hasta: string | null; valor_pagado: string }

export interface Jornada {
  id_jornada: number
  hora_inicio: string
  hora_final: string
  dia_semana: string
  tipo_jornada: 'Estimulación Temprana' | 'Iniciación Musical' | 'Ensamble Musical'
}

export interface PlantillaClase {
  id_plantilla: number
  id_jornada?: number
  jornada_detalle?: Jornada
  nombre: string
  descripcion?: string
  fecha_inicio: string
  fecha_fin: string | null
  activo: boolean
  es_recurrente: boolean
  frecuencia: 'semanal' | 'quincenal'
  alumnos?: AlumnoSummary[]
}

export interface Clase {
  id_clase: number
  id_jornada?: number
  jornada_detalle?: Jornada
  fecha: string
  alumnos?: AlumnoSummary[]
}

export interface Asistencia {
  id_asistencia: number
  alumno: string
  alumno_nombre: string
  clase: number
  fecha: string
  jornada: Jornada
  estado: 'programada' | 'presente' | 'ausente' | 'pospuesta'
  observacion: string
}

export interface Conversacion { id: number; acudiente: string; acudiente_nombre: string; creada_en: string; activa: boolean; ultimo_mensaje: Mensaje | null; no_leidos: number }
export interface Mensaje { id: number; conversacion: number; remitente_id: number | null; remitente_nombre: string; es_propio: boolean; cuerpo: string; archivo: string | null; archivo_url: string | null; creado_en: string; automatico: boolean; leido_por_acudiente: boolean; leido_por_personal: boolean }
