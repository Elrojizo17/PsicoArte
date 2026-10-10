from datetime import timedelta

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import SesionDispositivo, TicketWebSocket


MAX_ACTIVE_SESSIONS = 3
WEBSOCKET_TICKET_LIFETIME = timedelta(seconds=30)


@transaction.atomic
def close_device_session(session):
    session.activo = False
    session.save(update_fields=['activo'])
    session.push_subscriptions.all().delete()
    session.tickets_websocket.all().delete()
    channel_layer = get_channel_layer()
    if channel_layer is not None:
        transaction.on_commit(lambda: async_to_sync(channel_layer.group_send)(
            f'device_session_{session.pk}',
            {'type': 'session_closed'},
        ), robust=True)


class DeviceSessionsView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        current_session = request.auth
        sessions = SesionDispositivo.objects.filter(
            usuario=request.user,
            activo=True,
        ).order_by('-ultimo_uso')
        return Response([
            {
                'id': session.pk,
                'nombre': session.nombre_dispositivo,
                'creado': session.creado,
                'ultimo_uso': session.ultimo_uso,
                'actual': session.pk == current_session.pk,
            }
            for session in sessions
        ])


class DeviceSessionDetailView(APIView):
    permission_classes = (IsAuthenticated,)

    def delete(self, request, session_id):
        session = SesionDispositivo.objects.filter(
            pk=session_id,
            usuario=request.user,
            activo=True,
        ).first()
        if session is None:
            return Response(
                {'detail': 'La sesión no existe o ya está cerrada.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        close_device_session(session)
        return Response(status=status.HTTP_204_NO_CONTENT)


class LogoutView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        close_device_session(request.auth)
        return Response(status=status.HTTP_204_NO_CONTENT)


class WebSocketTicketView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        now = timezone.now()
        TicketWebSocket.objects.filter(
            Q(expira_en__lte=now) | Q(usado_en__isnull=False),
        ).delete()
        ticket = TicketWebSocket.objects.create(
            sesion=request.auth,
            expira_en=now + WEBSOCKET_TICKET_LIFETIME,
        )
        return Response({
            'ticket': ticket.key,
            'expires_in': int(WEBSOCKET_TICKET_LIFETIME.total_seconds()),
        })
