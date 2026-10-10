from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from .models import SesionDispositivo, TicketWebSocket


@transaction.atomic
def consume_websocket_ticket(ticket_key):
    if not ticket_key:
        return None

    ticket = TicketWebSocket.objects.select_for_update().filter(
        key=ticket_key,
        usado_en__isnull=True,
        expira_en__gt=timezone.now(),
    ).first()
    if ticket is None:
        return None

    session = SesionDispositivo.objects.select_for_update().select_related('usuario').get(
        pk=ticket.sesion_id,
    )
    if not session.activo or not session.usuario.is_active:
        return None

    now = timezone.now()
    if session.ultimo_uso <= now - timedelta(minutes=5):
        session.ultimo_uso = now
        session.save(update_fields=['ultimo_uso'])
    ticket.usado_en = now
    ticket.save(update_fields=['usado_en'])
    return session.usuario, session.pk
