from django.contrib import admin

from .models import Alumno, AlumnoClase, Acudiente, ClaseProgramada, Jornada


@admin.register(Acudiente)
class AcudienteAdmin(admin.ModelAdmin):
    list_display = ('numero_documento', 'nombre_1', 'apellido_1', 'tipo_documento', 'telefono_1')
    search_fields = ('numero_documento', 'nombre_1', 'apellido_1')


@admin.register(Alumno)
class AlumnoAdmin(admin.ModelAdmin):
    list_display = ('ti', 'nombre_1', 'apellido_1', 'acudiente')
    search_fields = ('ti', 'nombre_1', 'apellido_1')
    list_select_related = ('acudiente',)


@admin.register(Jornada)
class JornadaAdmin(admin.ModelAdmin):
    list_display = ('id_jornada', 'dia_semana', 'tipo_jornada', 'hora_inicio', 'hora_final')
    list_filter = ('tipo_jornada', 'dia_semana')


@admin.register(ClaseProgramada)
class ClaseProgramadaAdmin(admin.ModelAdmin):
    list_display = ('id_clase', 'jornada', 'fecha')
    list_filter = ('fecha', 'jornada__tipo_jornada')
    list_select_related = ('jornada',)


@admin.register(AlumnoClase)
class AlumnoClaseAdmin(admin.ModelAdmin):
    list_display = ('alumno', 'clase')
    list_select_related = ('alumno', 'clase')
