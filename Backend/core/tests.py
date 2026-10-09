from datetime import date, datetime, time
import sys
from types import ModuleType
from unittest.mock import Mock, patch

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .models import (
    Alumno,
    AlumnoClase,
    Asistencia,
    Acudiente,
    ClaseProgramada,
    Jornada,
    Mensaje,
    Pago,
    PlantillaMensaje,
    PushSubscription,
    RecordatorioEnviado,
)


class ApiCrudTests(APITestCase):
    def setUp(self):
        self.acudiente = Acudiente.objects.create(
            numero_documento='9001',
            nombre_1='Ana',
            apellido_1='Gomez',
            tipo_documento='CC',
            telefono_1='3000000000',
        )
        self.alumno = Alumno.objects.create(
            ti='1001',
            nombre_1='Luis',
            apellido_1='Gomez',
            acudiente=self.acudiente,
        )
        self.jornada = Jornada.objects.create(
            hora_inicio='08:00',
            hora_final='10:00',
            dia_semana='Lunes',
            tipo_jornada=Jornada.DESARROLLO_COGNITIVO,
        )
        self.clase = ClaseProgramada.objects.create(
            jornada=self.jornada,
            fecha=date(2026, 9, 23),
        )

    def test_crear_acudiente_requiere_telefono_principal(self):
        response = self.client.post(
            reverse('acudiente-list'),
            {
                'numero_documento': '9002',
                'nombre_1': 'Maria',
                'apellido_1': 'Lopez',
                'tipo_documento': 'CC',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('telefono_1', response.data)

    def test_crear_alumno_requiere_acudiente_existente(self):
        response = self.client.post(
            reverse('alumno-list'),
            {
                'ti': '1002',
                'nombre_1': 'Sofia',
                'apellido_1': 'Perez',
                'numero_documento_acudiente': 'no-existe',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertNotIn('1002', Alumno.objects.values_list('ti', flat=True))

    def test_jornada_rechaza_hora_final_anterior(self):
        response = self.client.post(
            reverse('jornada-list'),
            {
                'hora_inicio': '10:00',
                'hora_final': '08:00',
                'dia_semana': 'Martes',
                'tipo_jornada': Jornada.MUSICAL,
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('hora_final', response.data)

    def test_agregar_y_retirar_alumno_de_clase(self):
        url = reverse('clase-alumnos', kwargs={'pk': self.clase.pk})
        response = self.client.post(url, {'ti': self.alumno.ti}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        duplicate = self.client.post(url, {'ti': self.alumno.ti}, format='json')
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)

        response = self.client.delete(f'{url}{self.alumno.ti}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_no_se_puede_eliminar_acudiente_con_alumnos(self):
        response = self.client.delete(
            reverse('acudiente-detail', kwargs={'pk': self.acudiente.pk}),
        )
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)

    def test_no_se_puede_eliminar_jornada_con_clases(self):
        response = self.client.delete(
            reverse('jornada-detail', kwargs={'pk': self.jornada.pk}),
        )
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)

    def test_presente_y_ausente_consumen_pospuesta_no(self):
        second_class = ClaseProgramada.objects.create(jornada=self.jornada, fecha=date(2026, 9, 24))
        postponed_class = ClaseProgramada.objects.create(jornada=self.jornada, fecha=date(2026, 9, 25))
        for class_instance in (self.clase, second_class, postponed_class):
            AlumnoClase.objects.create(alumno=self.alumno, clase=class_instance)

        Asistencia.objects.create(alumno=self.alumno, clase=self.clase, estado=Asistencia.PRESENTE)
        Asistencia.objects.create(alumno=self.alumno, clase=second_class, estado=Asistencia.AUSENTE)
        Asistencia.objects.create(alumno=self.alumno, clase=postponed_class, estado=Asistencia.POSPUESTA)
        payment = Pago.objects.create(
            alumno=self.alumno,
            fecha_pago=date(2026, 9, 1),
            clases_pagadas=3,
            valor_pagado='150000.00',
        )

        detail = self.alumno.detalle_pagos(as_of=date(2026, 9, 30))[0]

        self.assertEqual(detail['pago'], payment)
        self.assertEqual(len(detail['clases_consumidas']), 2)
        self.assertEqual(detail['clases_disponibles'], 1)
        self.assertEqual(detail['clases_cubiertas'], [date(2026, 9, 23), date(2026, 9, 24)])


class PushSubscriptionApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='push-user', password='test-password')
        self.other_user = User.objects.create_user(username='other-user', password='test-password')
        self.client.force_authenticate(self.user)
        self.public_key_url = reverse('push-public-key')
        self.subscriptions_url = reverse('push-subscriptions')
        self.subscription_data = {
            'endpoint': 'https://push.example.test/subscription/123',
            'keys': {'p256dh': 'test-p256dh', 'auth': 'test-auth'},
        }

    def test_public_key_requires_authentication(self):
        self.client.force_authenticate(user=None)
        response = self.client.get(self.public_key_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @override_settings(VAPID_PUBLIC_KEY='test-public-key')
    def test_get_public_key(self):
        response = self.client.get(self.public_key_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {'publicKey': 'test-public-key'})

    @override_settings(VAPID_PUBLIC_KEY='')
    def test_get_public_key_reports_missing_configuration(self):
        response = self.client.get(self.public_key_url)
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)

    def test_register_subscription_and_repeat_is_idempotent(self):
        self.client.credentials(HTTP_USER_AGENT='PsicoArte test browser')
        first_response = self.client.post(
            self.subscriptions_url,
            self.subscription_data,
            format='json',
        )
        second_response = self.client.post(
            self.subscriptions_url,
            self.subscription_data,
            format='json',
        )

        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(first_response.data['created'])
        self.assertEqual(second_response.status_code, status.HTTP_200_OK)
        self.assertFalse(second_response.data['created'])
        self.assertEqual(PushSubscription.objects.count(), 1)
        saved = PushSubscription.objects.get()
        self.assertEqual(saved.usuario, self.user)
        self.assertEqual(saved.p256dh, 'test-p256dh')
        self.assertEqual(saved.auth, 'test-auth')
        self.assertEqual(saved.user_agent, 'PsicoArte test browser')

    def test_register_rejects_invalid_subscription(self):
        response = self.client.post(
            self.subscriptions_url,
            {'endpoint': 'not-a-url', 'keys': {}},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(PushSubscription.objects.count(), 0)

    def test_delete_subscription_only_removes_current_users_endpoint(self):
        subscription = PushSubscription.objects.create(
            usuario=self.other_user,
            endpoint=self.subscription_data['endpoint'],
            p256dh='test-p256dh',
            auth='test-auth',
        )
        response = self.client.delete(
            self.subscriptions_url,
            {'endpoint': self.subscription_data['endpoint']},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertTrue(PushSubscription.objects.filter(pk=subscription.pk).exists())

        subscription.usuario = self.user
        subscription.save(update_fields=['usuario'])
        response = self.client.delete(
            self.subscriptions_url,
            {'endpoint': self.subscription_data['endpoint']},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(PushSubscription.objects.filter(pk=subscription.pk).exists())

    def test_subscription_endpoints_require_authentication(self):
        self.client.force_authenticate(user=None)
        get_response = self.client.get(self.public_key_url)
        post_response = self.client.post(
            self.subscriptions_url,
            self.subscription_data,
            format='json',
        )
        delete_response = self.client.delete(
            self.subscriptions_url,
            {'endpoint': self.subscription_data['endpoint']},
            format='json',
        )
        self.assertEqual(get_response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(post_response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(delete_response.status_code, status.HTTP_401_UNAUTHORIZED)


class ReminderTaskTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='reminder-parent', password='test-password')
        self.acudiente = Acudiente.objects.create(
            usuario=self.user,
            numero_documento='9003',
            nombre_1='Laura',
            apellido_1='Perez',
            tipo_documento='CC',
            telefono_1='3000000001',
        )
        self.alumno = Alumno.objects.create(
            ti='1003',
            nombre_1='Mateo',
            apellido_1='Perez',
            acudiente=self.acudiente,
        )
        self.now = timezone.make_aware(
            datetime(2026, 9, 23, 7, 50),
            timezone.get_current_timezone(),
        )
        self.jornada = Jornada.objects.create(
            hora_inicio=time(8, 0),
            hora_final=time(10, 0),
            dia_semana='Miércoles',
            tipo_jornada=Jornada.DESARROLLO_COGNITIVO,
        )
        self.clase = ClaseProgramada.objects.create(
            jornada=self.jornada,
            fecha=self.now.date(),
        )
        AlumnoClase.objects.create(alumno=self.alumno, clase=self.clase)
        PlantillaMensaje.objects.create(
            tipo=PlantillaMensaje.RECORDATORIO_CLASE,
            texto='Recordatorio para {alumno} a las {hora} ({jornada}).',
            activo=True,
        )

    def test_recordatorio_no_se_duplica_al_ejecutar_dos_ciclos(self):
        from .tasks import revisar_recordatorios

        with patch('core.tasks.timezone.localtime', return_value=self.now):
            with patch('core.automation.async_to_sync'):
                first = revisar_recordatorios()
                second = revisar_recordatorios()

        self.assertEqual(first['mensajes_creados'], 1)
        self.assertEqual(second['mensajes_creados'], 0)
        self.assertEqual(RecordatorioEnviado.objects.filter(clase=self.clase, tipo=RecordatorioEnviado.INICIO).count(), 1)
        self.assertEqual(Mensaje.objects.filter(automatico=True).count(), 1)

    @override_settings(
        VAPID_PUBLIC_KEY='test-public-key',
        VAPID_PRIVATE_KEY='test-private-key',
        VAPID_ADMIN_EMAIL='test@example.com',
    )
    def test_push_se_envia_una_vez_por_acudiente_con_varios_alumnos(self):
        from .tasks import revisar_recordatorios

        second_student = Alumno.objects.create(
            ti='1004',
            nombre_1='Sofia',
            apellido_1='Perez',
            acudiente=self.acudiente,
        )
        AlumnoClase.objects.create(alumno=second_student, clase=self.clase)
        PushSubscription.objects.create(
            usuario=self.user,
            endpoint='https://push.example.test/subscription/reminder',
            p256dh='test-p256dh',
            auth='test-auth',
        )
        webpush = Mock()
        push_module = ModuleType('pywebpush')
        push_module.WebPushException = type('WebPushException', (Exception,), {})
        push_module.webpush = webpush

        with patch.dict(sys.modules, {'pywebpush': push_module}):
            with patch('core.tasks.timezone.localtime', return_value=self.now):
                with patch('core.automation.async_to_sync'):
                    with self.captureOnCommitCallbacks(execute=True):
                        revisar_recordatorios()

        self.assertEqual(Mensaje.objects.filter(automatico=True).count(), 2)
        webpush.assert_called_once()
