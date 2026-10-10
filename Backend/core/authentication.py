from datetime import timedelta

from django.db.models import Q
from django.utils import timezone
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed

from .models import SesionDispositivo


class SesionDispositivoAuthentication(BaseAuthentication):
    keyword = b'token'

    def authenticate(self, request):
        auth = get_authorization_header(request).split()
        if not auth:
            return None
        if auth[0].lower() != self.keyword:
            return None
        if len(auth) != 2:
            raise AuthenticationFailed('Credenciales de sesión inválidas.')

        try:
            key = auth[1].decode()
        except UnicodeError as exc:
            raise AuthenticationFailed('Credenciales de sesión inválidas.') from exc

        session = SesionDispositivo.objects.select_related('usuario').filter(
            key=key,
            activo=True,
            usuario__is_active=True,
        ).first()
        if session is None:
            raise AuthenticationFailed('La sesión ya no está activa.')

        now = timezone.now()
        stale_before = now - timedelta(minutes=5)
        SesionDispositivo.objects.filter(pk=session.pk).filter(
            Q(ultimo_uso__lte=stale_before) | Q(ultimo_uso__isnull=True),
        ).update(ultimo_uso=now)
        return session.usuario, session

    def authenticate_header(self, request):
        return 'Token'
