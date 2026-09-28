from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from rest_framework.authtoken.models import Token

from .models import Conversacion


class MessagingConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.conversation_id = self.scope['url_route']['kwargs']['conversation_id']
        token = parse_qs(self.scope['query_string'].decode()).get('token', [None])[0]
        self.user = await self.get_user(token)
        if not self.user or not await self.can_access_conversation():
            await self.close(code=4401)
            return

        self.group_name = f'mensajeria_{self.conversation_id}'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        if content.get('action') == 'mark_read':
            await self.mark_read()

    async def message_created(self, event):
        message = {**event['message'], 'es_propio': event['message']['remitente_id'] == self.user.id}
        await self.send_json(message)

    @database_sync_to_async
    def get_user(self, token_key):
        if not token_key:
            return None
        try:
            return Token.objects.select_related('user').get(key=token_key).user
        except Token.DoesNotExist:
            return None

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
