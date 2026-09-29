import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from .models import Conversacion, Mensaje
from .serializers import MensajeSerializer

logger = logging.getLogger(__name__)


def crear_mensaje_automatico(acudiente, texto):
    conversacion, _ = Conversacion.objects.get_or_create(acudiente=acudiente)
    mensaje = Mensaje.objects.create(conversacion=conversacion, cuerpo=texto, automatico=True)
    try:
        async_to_sync(get_channel_layer().group_send)(
            f'mensajeria_{conversacion.id}',
            {'type': 'message_created', 'message': MensajeSerializer(mensaje).data},
        )
    except Exception:
        # The database message is already saved; Redis being offline must not
        # make the API report a failed send and encourage duplicate retries.
        logger.exception('No se pudo emitir el mensaje %s por el channel layer.', mensaje.pk)
    return mensaje
