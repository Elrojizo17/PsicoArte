from rest_framework.routers import DefaultRouter

from .views import (
    AlumnoClaseViewSet,
    AlumnoViewSet,
    AcudienteViewSet,
    ClaseProgramadaViewSet,
    JornadaViewSet,
    login_view,
    PagoViewSet,
    AsistenciaViewSet,
    ConversacionViewSet,
    MensajeViewSet,
    PlantillaClaseViewSet,
    PlantillaMensajeListUpdateView,
    aviso_pagos_view,
)
from .push_views import PushPublicKeyView, PushSubscriptionView

from django.urls import path

router = DefaultRouter()
router.register('acudientes', AcudienteViewSet, basename='acudiente')
router.register('alumnos', AlumnoViewSet, basename='alumno')
router.register('jornadas', JornadaViewSet, basename='jornada')
router.register('clases', ClaseProgramadaViewSet, basename='clase')
router.register('plantillas-clase', PlantillaClaseViewSet, basename='plantilla-clase')
router.register('alumno-clase', AlumnoClaseViewSet, basename='alumno-clase')
router.register('pagos', PagoViewSet, basename='pago')
router.register('asistencias', AsistenciaViewSet, basename='asistencia')
router.register('mensajeria/conversaciones', ConversacionViewSet, basename='conversacion')
router.register('mensajeria/mensajes', MensajeViewSet, basename='mensaje')
router.register('automatizacion/plantillas', PlantillaMensajeListUpdateView, basename='plantilla-mensaje')

urlpatterns = [
    path('login/', login_view, name='login'),
    path('automatizacion/aviso-pagos/', aviso_pagos_view, name='aviso-pagos'),
    path('push/public-key/', PushPublicKeyView.as_view(), name='push-public-key'),
    path('push/subscriptions/', PushSubscriptionView.as_view(), name='push-subscriptions'),
] + router.urls
