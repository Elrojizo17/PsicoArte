import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from .models import Acudiente, Conversacion
from .websocket_auth import consume_websocket_ticket

logger = logging.getLogger(__name__)


class MessagingConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.conversation_id = self.scope['url_route']['kwargs']['conversation_id']
        ticket = get_ticket_from_protocols(self.scope.get('subprotocols', []))
        identity = await self.get_user(ticket)
        self.user, self.session_id = identity if identity else (None, None)
        if not self.user or not await self.can_access_conversation():
            logger.warning('WebSocket messaging rejected conversation_id=%s authenticated=%s', self.conversation_id, bool(self.user))
            await self.close(code=4401)
            return

        self.group_name = f'mensajeria_{self.conversation_id}'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        self.session_group_name = f'device_session_{self.session_id}'
        await self.channel_layer.group_add(self.session_group_name, self.channel_name)
        await self.accept(subprotocol='psicoarte')
        logger.info('WebSocket messaging connected conversation_id=%s user_id=%s', self.conversation_id, self.user.id)

    async def disconnect(self, close_code):
        logger.info('WebSocket messaging disconnected conversation_id=%s close_code=%s', getattr(self, 'conversation_id', None), close_code)
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)
        if hasattr(self, 'session_group_name'):
            await self.channel_layer.group_discard(self.session_group_name, self.channel_name)

    async def session_closed(self, event):
        await self.close(code=4401)

    async def receive_json(self, content, **kwargs):
        if content.get('action') == 'mark_read':
            await self.mark_read()

    async def message_created(self, event):
        logger.info('WebSocket message event delivered conversation_id=%s message_id=%s recipient_user_id=%s', self.conversation_id, event['message'].get('id'), self.user.id)
        message = {**event['message'], 'es_propio': event['message']['remitente_id'] == self.user.id}
        await self.send_json(message)

    async def read_receipt_created(self, event):
        await self.send_json({'type': 'read_receipt'})

    @database_sync_to_async
    def get_user(self, ticket_key):
        return consume_websocket_ticket(ticket_key)

    @database_sync_to_async
    def can_access_conversation(self):
        conversation = Conversacion.objects.filter(pk=self.conversation_id).select_related('acudiente__usuario').first()
        if not conversation:
            return False
        return (
            self.user.groups.filter(name__in=['Psicologia', 'Musical']).exists()
            or conversation.acudiente.usuario_id == self.user.id
        )

    @database_sync_to_async
    def mark_read(self):
        conversation = Conversacion.objects.get(pk=self.conversation_id)
        if conversation.acudiente.usuario_id == self.user.id:
            conversation.mensajes.filter(leido_por_acudiente=False).update(leido_por_acudiente=True)
        elif self.user.groups.filter(name__in=['Psicologia', 'Musical']).exists():
            conversation.mensajes.filter(leido_por_personal=False).update(leido_por_personal=True)


class MessagingInboxConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        ticket = get_ticket_from_protocols(self.scope.get('subprotocols', []))
        identity = await self.get_user(ticket)
        self.user, self.session_id = identity if identity else (None, None)
        if not self.user or not await self.can_access_inbox():
            logger.warning('Messaging inbox WebSocket rejected authenticated=%s', bool(self.user))
            await self.close(code=4401)
            return

        self.groups = [f'mensajeria_usuario_{self.user.id}']
        if await self.is_staff():
            self.groups.append('mensajeria_personal')
        for group in self.groups:
            await self.channel_layer.group_add(group, self.channel_name)
        self.session_group_name = f'device_session_{self.session_id}'
        await self.channel_layer.group_add(self.session_group_name, self.channel_name)
        await self.accept(subprotocol='psicoarte')

    async def disconnect(self, close_code):
        for group in getattr(self, 'groups', []):
            await self.channel_layer.group_discard(group, self.channel_name)
        if hasattr(self, 'session_group_name'):
            await self.channel_layer.group_discard(self.session_group_name, self.channel_name)

    async def session_closed(self, event):
        await self.close(code=4401)

    async def message_created(self, event):
        message = {
            **event['message'],
            'es_propio': event['message']['remitente_id'] == self.user.id,
        }
        await self.send_json(message)

    @database_sync_to_async
    def get_user(self, ticket_key):
        return consume_websocket_ticket(ticket_key)

    @database_sync_to_async
    def can_access_inbox(self):
        return (
            self.user.groups.filter(name__in=['Psicologia', 'Musical']).exists()
            or Acudiente.objects.filter(usuario_id=self.user.id).exists()
        )

    @database_sync_to_async
    def is_staff(self):
        return self.user.groups.filter(name__in=['Psicologia', 'Musical']).exists()


def get_ticket_from_protocols(protocols):
    for protocol in protocols:
        if protocol.startswith('ticket.'):
            return protocol.removeprefix('ticket.')
    return None
