import json
import logging

from django.conf import settings
from django.contrib.auth.models import User

from .models import PushSubscription

logger = logging.getLogger(__name__)


def send_message_push(message):
    parent_user_id = message.conversacion.acudiente.usuario_id
    if not parent_user_id:
        return 0, 0

    if message.remitente_id == parent_user_id:
        recipient_ids = User.objects.filter(
            groups__name__in=['Psicologia', 'Musical'],
        ).values_list('id', flat=True).distinct()
        subscriptions = PushSubscription.objects.filter(usuario_id__in=recipient_ids)
    else:
        subscriptions = PushSubscription.objects.filter(usuario_id=parent_user_id)
    if not subscriptions.exists():
        return 0, 0
    if not (settings.VAPID_PUBLIC_KEY and settings.VAPID_PRIVATE_KEY and settings.VAPID_ADMIN_EMAIL):
        logger.error('Web Push no configurado; message_id=%s', message.pk)
        return 0, subscriptions.count()

    try:
        from pywebpush import WebPushException, webpush

        payload = json.dumps({
            'title': 'PsicoArte - Mensajes',
            'body': (message.cuerpo or 'Te enviaron un archivo')[:140],
            'url': '/mensajeria/',
        })
    except Exception:
        logger.exception('Web Push setup failed message_id=%s', message.pk)
        return 0, subscriptions.count()

    sent = 0
    failed = 0
    for subscription in subscriptions:
        try:
            webpush(
                subscription_info={
                    'endpoint': subscription.endpoint,
                    'keys': {'p256dh': subscription.p256dh, 'auth': subscription.auth},
                },
                data=payload,
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_claims={'sub': f'mailto:{settings.VAPID_ADMIN_EMAIL}'},
            )
        except WebPushException as exc:
            failed += 1
            logger.exception('Web Push delivery failed subscription_id=%s', subscription.pk)
            if getattr(exc.response, 'status_code', None) in (404, 410):
                try:
                    subscription.delete()
                except Exception:
                    logger.exception('Could not delete expired push subscription_id=%s', subscription.pk)
        except Exception:
            failed += 1
            logger.exception('Web Push delivery failed subscription_id=%s', subscription.pk)
        else:
            sent += 1

    return sent, failed