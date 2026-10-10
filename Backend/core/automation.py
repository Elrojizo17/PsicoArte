from .models import Conversacion, Mensaje
from .messaging import dispatch_message
from .serializers import MensajeSerializer


def crear_mensaje_automatico(acudiente, texto):
    conversacion, _ = Conversacion.objects.get_or_create(acudiente=acudiente)
    mensaje = Mensaje.objects.create(conversacion=conversacion, cuerpo=texto, automatico=True)
    dispatch_message(mensaje, MensajeSerializer(mensaje).data)
    return mensaje
