from datetime import datetime, timedelta
import logging
import time

from django.db import transaction
from django.db import close_old_connections
from django.utils import timezone

from .automation import crear_mensaje_automatico
from .models import ClaseProgramada, PlantillaMensaje, RecordatorioEnviado

logger = logging.getLogger(__name__)


def ejecutar_recordatorios_periodicos():
    while True:
        try:
            close_old_connections()
            cantidad = revisar_recordatorios()
            if cantidad:
                logger.info('Mensajes automáticos creados: %s', cantidad)
        except Exception:
            logger.exception('Falló la revisión automática de recordatorios.')
        finally:
            close_old_connections()
        time.sleep(60)


def revisar_recordatorios():
    ahora = timezone.localtime()
    limite = ahora + timedelta(minutes=15)
    clases = ClaseProgramada.objects.filter(fecha=ahora.date()).select_related('jornada').prefetch_related('inscripciones__alumno__acudiente')
    plantillas = {p.tipo: p for p in PlantillaMensaje.objects.filter(activo=True)}
    enviados = 0
    for clase in clases:
        recordatorios = (
            (RecordatorioEnviado.INICIO, clase.jornada.hora_inicio, PlantillaMensaje.RECORDATORIO_CLASE),
            (RecordatorioEnviado.RECOGIDA, clase.jornada.hora_final, PlantillaMensaje.RECORDATORIO_RECOGIDA),
        )
        for tipo, hora, tipo_plantilla in recordatorios:
            evento = timezone.make_aware(datetime.combine(clase.fecha, hora), timezone.get_current_timezone())
            plantilla = plantillas.get(tipo_plantilla)
            if not plantilla or not (ahora <= evento <= limite):
                continue
            with transaction.atomic():
                _, creado = RecordatorioEnviado.objects.get_or_create(clase=clase, tipo=tipo)
                if not creado:
                    continue
                for inscripcion in clase.inscripciones.all():
                    alumno = inscripcion.alumno
                    nombre = ' '.join(filter(None, [alumno.nombre_1, alumno.nombre_2, alumno.apellido_1, alumno.apellido_2]))
                    texto = plantilla.texto.format(alumno=nombre, hora=hora.strftime('%H:%M'), jornada=clase.jornada.tipo_jornada)
                    crear_mensaje_automatico(alumno.acudiente, texto)
                    enviados += 1
    return enviados
