from django.urls import path

from core.consumers import MessagingConsumer

websocket_urlpatterns = [
    path('ws/mensajeria/<int:conversation_id>/', MessagingConsumer.as_asgi()),
]
