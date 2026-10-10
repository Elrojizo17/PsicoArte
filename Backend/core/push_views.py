from django.conf import settings
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import PushSubscription


class PushSubscriptionKeysSerializer(serializers.Serializer):
    p256dh = serializers.CharField(max_length=255)
    auth = serializers.CharField(max_length=255)


class PushSubscriptionSerializer(serializers.Serializer):
    endpoint = serializers.URLField(max_length=2000)
    keys = PushSubscriptionKeysSerializer()


class PushSubscriptionEndpointSerializer(serializers.Serializer):
    endpoint = serializers.URLField(max_length=2000)


class PushPublicKeyView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        public_key = getattr(settings, 'VAPID_PUBLIC_KEY', '')
        if not public_key:
            return Response(
                {'detail': 'La clave pública VAPID no está configurada.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response({'publicKey': public_key})


class PushSubscriptionView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        serializer = PushSubscriptionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        subscription = serializer.validated_data
        keys = subscription['keys']
        instance, created = PushSubscription.objects.update_or_create(
            endpoint=subscription['endpoint'],
            defaults={
                'sesion': request.auth,
                'p256dh': keys['p256dh'],
                'auth': keys['auth'],
                'user_agent': request.META.get('HTTP_USER_AGENT', '')[:1024],
            },
        )
        return Response(
            {'id': instance.pk, 'created': created},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def delete(self, request):
        serializer = PushSubscriptionEndpointSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        PushSubscription.objects.filter(
            sesion=request.auth,
            endpoint=serializer.validated_data['endpoint'],
        ).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
