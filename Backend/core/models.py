from django.core.exceptions import ValidationError
from django.contrib.auth.models import User
from django.db import models


class Acudiente(models.Model):
    usuario = models.OneToOneField(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='acudiente'
    )
    numero_documento = models.CharField(max_length=30, primary_key=True)
    nombre_1 = models.CharField(max_length=100)
    nombre_2 = models.CharField(max_length=100, blank=True)
    apellido_1 = models.CharField(max_length=100)
    apellido_2 = models.CharField(max_length=100, blank=True)
    tipo_documento = models.CharField(max_length=30)
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
    ti = models.CharField(max_length=30, primary_key=True)
    nombre_1 = models.CharField(max_length=100)
    nombre_2 = models.CharField(max_length=100, blank=True)
    apellido_1 = models.CharField(max_length=100)
    apellido_2 = models.CharField(max_length=100, blank=True)
    identificacion = models.CharField(max_length=100, null=True, blank=True)
    tipo_sangre = models.CharField(max_length=5, blank=True)
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


class Jornada(models.Model):
    DESARROLLO_COGNITIVO = 'Desarrollo Cognitivo'
    MUSICAL = 'Musical'
    TIPOS_JORNADA = (
        (DESARROLLO_COGNITIVO, 'Desarrollo Cognitivo'),
        (MUSICAL, 'Musical'),
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

    class Meta:
        db_table = 'clase_programada'
        ordering = ['-fecha', 'id_clase']

    def __str__(self):
        return f'Clase {self.id_clase} - {self.fecha}'


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
