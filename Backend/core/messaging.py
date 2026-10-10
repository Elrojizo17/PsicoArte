import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


logger = logging.getLogger(__name__)


def dispatch_message(message, payload):
    conversation = message.conversacion
    recipient_user_id = conversation.acudiente.usuario_id
    groups = [f'mensajeria_{conversation.id}']
    if recipient_user_id:
        groups.append(f'mensajeria_usuario_{recipient_user_id}')
    groups.append('mensajeria_personal')

    channel_layer = get_channel_layer()
    for group in groups:
        try:
            async_to_sync(channel_layer.group_send)(
                group,
                {'type': 'message_created', 'message': payload},
            )
        except Exception:
            logger.exception(
                'WebSocket message dispatch failed conversation_id=%s group=%s',
                conversation.id,
                group,
            )
