from datetime import datetime, timedelta
import logging
import time

from django.db import transaction
from django.db import close_old_connections
from django.utils import timezone

from .automation import crear_mensaje_automatico
from .models import ClaseProgramada, PlantillaMensaje, RecordatorioEnviado
from .push import send_message_push

logger = logging.getLogger(__name__)


def ejecutar_recordatorios_periodicos():
    while True:
        try:
            close_old_connections()
            resultado = revisar_recordatorios()
            nivel = logger.info if any(
                resultado[clave]
                for clave in ('recordatorios_elegibles', 'mensajes_creados', 'push_enviadas', 'push_fallidas')
            ) else logger.debug
            nivel(
                'ciclo: clases hoy=%s, recordatorios elegibles=%s, mensajes creados=%s, '
                'push enviadas=%s, push fallidas=%s',
                resultado['clases_hoy'],
                resultado['recordatorios_elegibles'],
                resultado['mensajes_creados'],
                resultado['push_enviadas'],
                resultado['push_fallidas'],
            )
        except Exception:
            logger.exception('Falló la revisión automática de recordatorios.')
        finally:
            close_old_connections()
        time.sleep(60)


def revisar_recordatorios(dry_run=False, output=None):
    ahora = timezone.localtime()
    limite = ahora + timedelta(minutes=15)
    clases = list(ClaseProgramada.objects.filter(fecha=ahora.date()).select_related('jornada').prefetch_related('inscripciones__alumno__acudiente'))
    plantillas = {p.tipo: p for p in PlantillaMensaje.objects.filter(activo=True)}
    enviados = 0
    recordatorios_elegibles = 0
    push_stats = {'enviadas': 0, 'fallidas': 0}
    push_en_acudiente = set()

    def enviar_push(message, key):
        if key in push_en_acudiente:
            return
        push_en_acudiente.add(key)
        try:
            enviadas, fallidas = send_message_push(message)
            push_stats['enviadas'] += enviadas
            push_stats['fallidas'] += fallidas
        except Exception:
            push_stats['fallidas'] += 1
            logger.exception('Falló el push del mensaje automático %s.', message.pk)

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
            if dry_run:
                if RecordatorioEnviado.objects.filter(clase=clase, tipo=tipo).exists():
                    continue
                recordatorios_elegibles += 1
                acudientes = list(dict.fromkeys(
                    str(inscripcion.alumno.acudiente)
                    for inscripcion in clase.inscripciones.all()
                ))
                if output:
                    output.write(
                        f'clase={clase.pk}, tipo={tipo}, hora={hora.strftime("%H:%M")}, '
                        f'acudientes={", ".join(acudientes) or "ninguno"}'
                    )
                continue
            with transaction.atomic():
                _, creado = RecordatorioEnviado.objects.get_or_create(clase=clase, tipo=tipo)
                if not creado:
                    continue
                recordatorios_elegibles += 1
                for inscripcion in clase.inscripciones.all():
                    alumno = inscripcion.alumno
                    nombre = ' '.join(filter(None, [alumno.nombre_1, alumno.nombre_2, alumno.apellido_1, alumno.apellido_2]))
                    texto = plantilla.texto.format(alumno=nombre, hora=hora.strftime('%H:%M'), jornada=clase.jornada.tipo_jornada)
                    mensaje = crear_mensaje_automatico(alumno.acudiente, texto)
                    push_key = (clase.pk, tipo, alumno.acudiente.pk)
                    transaction.on_commit(lambda message=mensaje, key=push_key: enviar_push(message, key))
                    enviados += 1
    return {
        'clases_hoy': len(clases),
        'recordatorios_elegibles': recordatorios_elegibles,
        'mensajes_creados': enviados,
        'push_enviadas': push_stats['enviadas'],
        'push_fallidas': push_stats['fallidas'],
    }
