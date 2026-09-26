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
  numero_documento_acudiente?: string
  acudiente_detalle?: Acudiente
  fecha_nacimiento?: string | null
  clases?: ClaseSummary[]
}

export interface Jornada {
  id_jornada: number
  hora_inicio: string
  hora_final: string
  dia_semana: string
  tipo_jornada: 'Desarrollo Cognitivo' | 'Musical'
}

export interface Clase {
  id_clase: number
  id_jornada?: number
  jornada_detalle?: Jornada
  fecha: string
  alumnos?: AlumnoSummary[]
}
