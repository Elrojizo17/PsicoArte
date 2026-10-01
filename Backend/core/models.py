from django.core.exceptions import ValidationError
from django.contrib.auth.models import User
from django.db import models


JORNADAS_MUSICALES = (
    ('Lunes', '11:15', '12:00', 'Estimulación Temprana'),
    ('Lunes', '16:30', '17:15', 'Estimulación Temprana'),
    ('Lunes', '17:15', '18:00', 'Iniciación Musical'),
    ('Lunes', '18:00', '18:45', 'Ensamble Musical'),
    ('Martes', '11:15', '12:00', 'Estimulación Temprana'),
    ('Martes', '16:30', '17:15', 'Estimulación Temprana'),
    ('Martes', '17:15', '18:00', 'Iniciación Musical'),
    ('Martes', '18:00', '18:45', 'Ensamble Musical'),
    ('Miércoles', '11:15', '12:00', 'Estimulación Temprana'),
    ('Miércoles', '16:30', '17:15', 'Estimulación Temprana'),
    ('Jueves', '11:15', '12:00', 'Estimulación Temprana'),
    ('Jueves', '16:30', '17:15', 'Estimulación Temprana'),
    ('Jueves', '17:15', '18:00', 'Iniciación Musical'),
    ('Jueves', '18:00', '18:45', 'Ensamble Musical'),
    ('Viernes', '17:00', '17:45', 'Iniciación Musical'),
    ('Viernes', '17:45', '18:30', 'Ensamble Musical'),
)


class Acudiente(models.Model):
    usuario = models.OneToOneField(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='acudiente'
    )
    numero_documento = models.CharField(max_length=30, primary_key=True, blank=True)
    nombre_1 = models.CharField(max_length=100)
    nombre_2 = models.CharField(max_length=100, blank=True)
    apellido_1 = models.CharField(max_length=100)
    apellido_2 = models.CharField(max_length=100, blank=True)
    tipo_documento = models.CharField(max_length=30, blank=True)
    correo = models.EmailField(max_length=254, blank=True)
    telefono_1 = models.CharField(max_length=30)
    telefono_2 = models.CharField(max_length=30, blank=True)
    telefono_3 = models.CharField(max_length=30, blank=True)

    class Meta:
        db_table = 'acudiente'
        ordering = ['apellido_1', 'nombre_1']

    def __str__(self):
        return f'{self.nombre_1} {self.apellido_1} ({self.numero_documento})'


class Alumno(models.Model):
    ti = models.CharField(max_length=30, primary_key=True, blank=True)
    nombre_1 = models.CharField(max_length=100)
    nombre_2 = models.CharField(max_length=100, blank=True)
    apellido_1 = models.CharField(max_length=100)
    apellido_2 = models.CharField(max_length=100, blank=True)
    identificacion = models.CharField(max_length=100, null=True, blank=True)
    tipo_sangre = models.CharField(max_length=5, blank=True)
    eps = models.CharField(max_length=150, blank=True)
    acudiente = models.ForeignKey(
        Acudiente,
        on_delete=models.PROTECT,
        db_column='numero_documento_acudiente',
        related_name='alumnos',
    )
    fecha_nacimiento = models.DateField(null=True, blank=True)

    class Meta:
        db_table = 'alumno'
        ordering = ['apellido_1', 'nombre_1']

    def __str__(self):
        return f'{self.nombre_1} {self.apellido_1} ({self.ti})'

    def detalle_pagos(self, as_of=None):
        from datetime import date

        as_of = as_of or date.today()
        payment_list = list(self.pagos.order_by('fecha_pago', 'id_pago'))
        remaining = {payment.id_pago: payment.clases_pagadas for payment in payment_list}
        allocations = {payment.id_pago: [] for payment in payment_list}
        first_payment = payment_list[0] if payment_list else None
        attendance_states = dict(self.asistencias.values_list('clase_id', 'estado'))
        enrolled_classes = self.inscripciones.select_related('clase').order_by('clase__fecha', 'clase__id_clase')
        if first_payment:
            enrolled_classes = enrolled_classes.filter(clase__fecha__gte=first_payment.fecha_pago)

        for enrollment in enrolled_classes:
            class_date = enrollment.clase.fecha
            if class_date > as_of or attendance_states.get(enrollment.clase_id) not in (
                Asistencia.PRESENTE,
                Asistencia.AUSENTE,
            ):
                continue
            for payment in payment_list:
                if payment.fecha_pago <= class_date and remaining[payment.id_pago] > 0:
                    allocations[payment.id_pago].append(class_date)
                    remaining[payment.id_pago] -= 1
                    break

        details = []
        for payment in payment_list:
            covered_dates = allocations[payment.id_pago]
            details.append({
                'pago': payment,
                'clases_consumidas': [class_date for class_date in covered_dates if class_date <= as_of],
                'clases_cubiertas': covered_dates,
                'clases_disponibles': remaining[payment.id_pago],
                'fecha_cubre_hasta': covered_dates[-1] if covered_dates else None,
            })
        return details

    def resumen_pagos(self, as_of=None):
        from datetime import date
        from decimal import Decimal

        as_of = as_of or date.today()
        payments = self.pagos.order_by('fecha_pago', 'id_pago')
        details = self.detalle_pagos(as_of)
        total_paid = sum((detail['pago'].clases_pagadas for detail in details), 0)
        consumed = sum((len(detail['clases_consumidas']) for detail in details), 0)
        available = sum((detail['clases_disponibles'] for detail in details), 0)
        covered_dates = [class_date for detail in details for class_date in detail['clases_cubiertas']]
        next_payment_date = None
        if total_paid and available == 0:
            next_payment_date = self.inscripciones.filter(clase__fecha__gt=as_of).order_by('clase__fecha', 'clase__id_clase').values_list('clase__fecha', flat=True).first()
        if total_paid == 0:
            state = 'sin_pago'
        elif available > 0:
            state = 'vigente'
        else:
            state = 'vencido'
        return {
            'clases_pagadas': total_paid,
            'clases_impartidas': consumed,
            'clases_disponibles': available,
            'estado_pago': state,
            'fecha_ultimo_pago': payments.order_by('-fecha_pago', '-id_pago').values_list('fecha_pago', flat=True).first(),
            'fecha_proximo_pago': next_payment_date,
            'fecha_cubre_hasta': max(covered_dates) if covered_dates else None,
            'valor_pagado': sum((payment.valor_pagado for payment in payments), Decimal('0.00')),
        }


class Jornada(models.Model):
    ESTIMULACION_TEMPRANA = 'Estimulación Temprana'
    ESTIMULACION_INICIAL = ESTIMULACION_TEMPRANA
    INICIACION_MUSICAL = 'Iniciación Musical'
    ENSAMBLE_MUSICAL = 'Ensamble Musical'
    DESARROLLO_COGNITIVO = ESTIMULACION_INICIAL
    MUSICAL = ENSAMBLE_MUSICAL
    TIPOS_JORNADA = (
        (ESTIMULACION_TEMPRANA, 'Estimulación Temprana'),
        (INICIACION_MUSICAL, 'Iniciación Musical'),
        (ENSAMBLE_MUSICAL, 'Ensamble Musical'),
    )

    id_jornada = models.AutoField(primary_key=True)
    hora_inicio = models.TimeField()
    hora_final = models.TimeField()
    dia_semana = models.CharField(max_length=20)
    tipo_jornada = models.CharField(max_length=30, choices=TIPOS_JORNADA)

    class Meta:
        db_table = 'jornada'
        ordering = ['dia_semana', 'hora_inicio']

    def clean(self):
        if self.hora_final <= self.hora_inicio:
            raise ValidationError({'hora_final': 'Debe ser posterior a hora_inicio.'})

    def __str__(self):
        return f'{self.tipo_jornada} - {self.dia_semana}'


class ClaseProgramada(models.Model):
    id_clase = models.AutoField(primary_key=True)
    jornada = models.ForeignKey(
        Jornada,
        on_delete=models.PROTECT,
        db_column='id_jornada',
        related_name='clases',
    )
    fecha = models.DateField()
    plantilla = models.ForeignKey(
        'PlantillaClase',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='clases_generadas',
    )

    class Meta:
        db_table = 'clase_programada'
        ordering = ['-fecha', 'id_clase']

    def __str__(self):
        return f'Clase {self.id_clase} - {self.fecha}'


class PlantillaClase(models.Model):
    id_plantilla = models.AutoField(primary_key=True)
    jornada = models.ForeignKey(
        Jornada,
        on_delete=models.PROTECT,
        db_column='id_jornada',
        related_name='plantillas',
    )
    nombre = models.CharField(max_length=120, blank=True)
    descripcion = models.CharField(max_length=255, blank=True)
    fecha_inicio = models.DateField()
    fecha_fin = models.DateField(null=True, blank=True)
    activo = models.BooleanField(default=True)
    es_recurrente = models.BooleanField(default=True)
    frecuencia = models.CharField(max_length=20, default='semanal', choices=(
        ('semanal', 'Semanal'),
        ('quincenal', 'Quincenal'),
    ))

    class Meta:
        db_table = 'plantilla_clase'
        ordering = ['fecha_inicio', 'id_plantilla']

    def __str__(self):
        return self.nombre or f'Plantilla {self.id_plantilla}'

    def obtener_alumnos_para_fecha(self, fecha):
        alumnos = set(
            PlantillaClaseAlumno.objects.filter(plantilla=self).values_list('alumno_id', flat=True)
        )
        for excepcion in ExcepcionClase.objects.filter(plantilla=self, fecha=fecha):
            if excepcion.accion == ExcepcionClase.AGREGAR:
                alumnos.add(excepcion.alumno_id)
            elif excepcion.accion == ExcepcionClase.QUITAR:
                alumnos.discard(excepcion.alumno_id)
        return Alumno.objects.filter(ti__in=alumnos).order_by('apellido_1', 'nombre_1')


class PlantillaClaseAlumno(models.Model):
    plantilla = models.ForeignKey(PlantillaClase, on_delete=models.CASCADE, related_name='alumnos')
    alumno = models.ForeignKey(Alumno, on_delete=models.CASCADE, related_name='plantillas_clase')

    class Meta:
        db_table = 'plantilla_clase_alumno'
        constraints = [
            models.UniqueConstraint(fields=['plantilla', 'alumno'], name='uq_plantilla_alumno_alumno'),
        ]

    def __str__(self):
        return f'{self.plantilla_id} - {self.alumno_id}'


class ExcepcionClase(models.Model):
    AGREGAR = 'agregar'
    QUITAR = 'quitar'
    ACCIONES = (
        (AGREGAR, 'Agregar estudiante'),
        (QUITAR, 'Quitar estudiante'),
    )

    plantilla = models.ForeignKey(PlantillaClase, on_delete=models.CASCADE, related_name='excepciones')
    fecha = models.DateField()
    alumno = models.ForeignKey(Alumno, on_delete=models.CASCADE, related_name='excepciones_clase')
    accion = models.CharField(max_length=20, choices=ACCIONES, default=AGREGAR)
    observacion = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = 'excepcion_clase'
        constraints = [
            models.UniqueConstraint(fields=['plantilla', 'fecha', 'alumno'], name='uq_excepcion_plantilla_fecha_alumno'),
        ]

    def __str__(self):
        return f'{self.plantilla_id} - {self.fecha} - {self.alumno_id} ({self.accion})'


class AlumnoClase(models.Model):
    pk = models.CompositePrimaryKey('alumno', 'clase')
    alumno = models.ForeignKey(
        Alumno,
        on_delete=models.CASCADE,
        db_column='ti',
        related_name='inscripciones',
    )
    clase = models.ForeignKey(
        ClaseProgramada,
        on_delete=models.CASCADE,
        db_column='id_clase',
        related_name='inscripciones',
    )

    class Meta:
        db_table = 'alumno_clase'
        constraints = [
            models.UniqueConstraint(
                fields=['alumno', 'clase'],
                name='uq_alumno_clase_alumno_clase',
            ),
        ]

    def __str__(self):
        return f'{self.alumno_id} - {self.clase_id}'


class Asistencia(models.Model):
    PROGRAMADA = 'programada'
    PRESENTE = 'presente'
    AUSENTE = 'ausente'
    POSPUESTA = 'pospuesta'
    ESTADOS = (
        (PROGRAMADA, 'Programada'),
        (PRESENTE, 'Presente'),
        (AUSENTE, 'Ausente'),
        (POSPUESTA, 'Pospuesta'),
    )

    id_asistencia = models.AutoField(primary_key=True)
    alumno = models.ForeignKey(Alumno, on_delete=models.CASCADE, related_name='asistencias')
    clase = models.ForeignKey(ClaseProgramada, on_delete=models.CASCADE, related_name='asistencias')
    estado = models.CharField(max_length=20, choices=ESTADOS, default=PROGRAMADA)
    observacion = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = 'asistencia'
        ordering = ['-clase__fecha', '-id_asistencia']
        constraints = [
            models.UniqueConstraint(fields=['alumno', 'clase'], name='uq_asistencia_alumno_clase'),
        ]

    def __str__(self):
        return f'{self.alumno_id} - {self.clase_id} - {self.estado}'


class Conversacion(models.Model):
    acudiente = models.OneToOneField(Acudiente, on_delete=models.CASCADE, related_name='conversacion')
    creada_en = models.DateTimeField(auto_now_add=True)
    activa = models.BooleanField(default=True)

    class Meta:
        db_table = 'conversacion'
        ordering = ['-creada_en']

    def __str__(self):
        return f'Conversación con {self.acudiente}'


class Mensaje(models.Model):
    conversacion = models.ForeignKey(Conversacion, on_delete=models.CASCADE, related_name='mensajes')
    remitente = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='mensajes_enviados')
    cuerpo = models.TextField(blank=True)
    archivo = models.FileField(upload_to='mensajeria/%Y/%m/', null=True, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    leido_por_acudiente = models.BooleanField(default=False)
    leido_por_personal = models.BooleanField(default=False)
    automatico = models.BooleanField(default=False)

    class Meta:
        db_table = 'mensaje'
        ordering = ['creado_en', 'id']

    def __str__(self):
        return f'Mensaje {self.id} en conversación {self.conversacion_id}'


class PlantillaMensaje(models.Model):
    RECORDATORIO_CLASE = 'recordatorio_clase'
    RECORDATORIO_RECOGIDA = 'recordatorio_recogida'
    AVISO_PAGO = 'aviso_pago'
    TIPOS = (
        (RECORDATORIO_CLASE, 'Recordatorio de clase'),
        (RECORDATORIO_RECOGIDA, 'Recordatorio de recogida'),
        (AVISO_PAGO, 'Aviso de pago'),
    )

    tipo = models.CharField(max_length=30, choices=TIPOS, unique=True)
    texto = models.TextField()
    activo = models.BooleanField(default=True)

    class Meta:
        db_table = 'plantilla_mensaje'
        ordering = ['tipo']

    def __str__(self):
        return self.get_tipo_display()


class RecordatorioEnviado(models.Model):
    INICIO = 'inicio'
    RECOGIDA = 'recogida'
    TIPOS = ((INICIO, 'Inicio'), (RECOGIDA, 'Recogida'))

    clase = models.ForeignKey(ClaseProgramada, on_delete=models.CASCADE, related_name='recordatorios_enviados')
    tipo = models.CharField(max_length=10, choices=TIPOS)
    enviado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'recordatorio_enviado'
        constraints = [models.UniqueConstraint(fields=['clase', 'tipo'], name='uq_recordatorio_clase_tipo')]


class Pago(models.Model):
    id_pago = models.AutoField(primary_key=True)
    alumno = models.ForeignKey(Alumno, on_delete=models.CASCADE, related_name='pagos', db_column='ti_alumno')
    fecha_pago = models.DateField()
    clases_pagadas = models.PositiveIntegerField()
    valor_pagado = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        db_table = 'pago'
        ordering = ['-fecha_pago', '-id_pago']

    def __str__(self):
        return f'{self.alumno_id} - {self.fecha_pago} ({self.clases_pagadas} clases)'
