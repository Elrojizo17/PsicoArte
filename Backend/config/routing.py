from django.urls import path

from core.consumers import MessagingConsumer, MessagingInboxConsumer

websocket_urlpatterns = [
    path('ws/mensajeria/', MessagingInboxConsumer.as_asgi()),
    path('ws/mensajeria/<int:conversation_id>/', MessagingConsumer.as_asgi()),
]
