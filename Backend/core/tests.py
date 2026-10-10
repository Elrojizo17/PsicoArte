from datetime import date, datetime, time, timedelta
import sys
from types import ModuleType
from unittest.mock import Mock, patch

from django.contrib.auth.models import Group, User
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
    Conversacion,
    Jornada,
    Mensaje,
    Pago,
    PlantillaMensaje,
    PushSubscription,
    RecordatorioEnviado,
    SesionDispositivo,
    TicketWebSocket,
)


class ApiCrudTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='api-crud-staff', password='test-password')
        self.user.groups.add(Group.objects.get_or_create(name='Psicologia')[0])
        session = SesionDispositivo.objects.create(
            usuario=self.user,
            dispositivo_id='api-crud-test-device',
            nombre_dispositivo='Test browser',
            ultimo_uso=timezone.now(),
        )
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {session.key}')
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


class ConversationOrderingApiTests(APITestCase):
    def test_conversations_sort_by_latest_message_and_include_preview_and_unread_count(self):
        staff = User.objects.create_user(username='messaging-staff', password='test-password')
        sender = User.objects.create_user(username='messaging-sender', password='test-password')
        staff.groups.add(Group.objects.get_or_create(name='Psicologia')[0])
        conversations = []
        for number in range(4):
            guardian = Acudiente.objects.create(
                numero_documento=f'conversation-{number}',
                nombre_1=f'Guardian {number}',
                apellido_1='Test',
                telefono_1='3000000000',
            )
            conversations.append(Conversacion.objects.create(acudiente=guardian))

        older = timezone.make_aware(datetime(2026, 1, 1, 10, 0))
        recent = timezone.make_aware(datetime(2026, 1, 2, 10, 0))
        first_message = Mensaje.objects.create(
            conversacion=conversations[1],
            remitente=sender,
            cuerpo='Mensaje anterior',
        )
        first_message.creado_en = older
        first_message.save(update_fields=['creado_en'])
        latest_message = Mensaje.objects.create(
            conversacion=conversations[1],
            remitente=sender,
            cuerpo='Vista previa reciente',
        )
        latest_message.creado_en = recent
        latest_message.save(update_fields=['creado_en'])
        tied_message = Mensaje.objects.create(
            conversacion=conversations[2],
            remitente=sender,
            cuerpo='Mismo instante',
        )
        tied_message.creado_en = recent
        tied_message.save(update_fields=['creado_en'])
        older_message = Mensaje.objects.create(
            conversacion=conversations[0],
            remitente=sender,
            cuerpo='Mensaje antiguo',
        )
        older_message.creado_en = older
        older_message.save(update_fields=['creado_en'])

        self.client.force_authenticate(staff)
        response = self.client.get(reverse('conversacion-list'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data
        self.assertEqual(
            [item['id'] for item in results],
            [conversations[2].id, conversations[1].id, conversations[0].id, conversations[3].id],
        )
        preview = next(item for item in results if item['id'] == conversations[1].id)
        self.assertEqual(preview['ultimo_mensaje']['cuerpo'], 'Vista previa reciente')
        self.assertEqual(preview['ultimo_mensaje']['creado_en'], latest_message.creado_en.isoformat())
        self.assertEqual(preview['ultimo_mensaje']['remitente_id'], sender.id)
        self.assertEqual(preview['no_leidos'], 2)


class DeviceSessionApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='session-user', password='test-password')
        self.user.groups.add(Group.objects.get_or_create(name='Psicologia')[0])
        self.login_url = reverse('login')
        self.device_id = 'installed-device-123'

    def create_session(self, device_id, active=True):
        return SesionDispositivo.objects.create(
            usuario=self.user,
            dispositivo_id=device_id,
            nombre_dispositivo=f'Chrome {device_id}',
            ultimo_uso=timezone.now(),
            activo=active,
        )

    def login(self, **extra):
        with patch('rest_framework.throttling.AnonRateThrottle.allow_request', return_value=True):
            return self.client.post(
                self.login_url,
                {'username': self.user.username, 'password': 'test-password', 'device_id': self.device_id, **extra},
                format='json',
                HTTP_USER_AGENT='Mozilla/5.0 (Linux; Android 14) Chrome/125.0',
            )

    def test_login_rejects_fourth_active_device_with_device_list(self):
        sessions = [self.create_session(f'active-device-{index}') for index in range(3)]

        response = self.login()

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data['codigo'], 'limite_dispositivos')
        self.assertEqual(
            {item['id'] for item in response.data['dispositivos']},
            {session.pk for session in sessions},
        )
        self.assertEqual(
            set(response.data['dispositivos'][0]),
            {'id', 'nombre', 'ultimo_uso'},
        )

    def test_login_closes_selected_session_then_creates_new_device_session(self):
        sessions = [self.create_session(f'active-device-{index}') for index in range(3)]

        response = self.login(cerrar_sesion_id=sessions[0].pk)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        sessions[0].refresh_from_db()
        self.assertFalse(sessions[0].activo)
        self.assertEqual(
            SesionDispositivo.objects.filter(usuario=self.user, activo=True).count(),
            3,
        )
        self.assertEqual(response.data['device_id'], self.device_id)
        self.assertEqual(len(response.data['token']), 64)

    def test_login_reuses_existing_device_session(self):
        existing = self.create_session(self.device_id)

        response = self.login()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['session_id'], existing.pk)
        self.assertEqual(response.data['token'], existing.key)
        self.assertEqual(SesionDispositivo.objects.filter(usuario=self.user).count(), 1)

    def test_logout_closes_only_current_session_and_removes_its_push(self):
        current = self.create_session('current-device')
        other = self.create_session('other-device')
        current_push = PushSubscription.objects.create(
            sesion=current,
            endpoint='https://push.example.test/session/current',
            p256dh='current-p256dh',
            auth='current-auth',
        )
        other_push = PushSubscription.objects.create(
            sesion=other,
            endpoint='https://push.example.test/session/other',
            p256dh='other-p256dh',
            auth='other-auth',
        )
        ticket = TicketWebSocket.objects.create(
            sesion=current,
            expira_en=timezone.now() + timedelta(seconds=30),
        )
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {current.key}')

        response = self.client.post(reverse('logout'))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        current.refresh_from_db()
        other.refresh_from_db()
        self.assertFalse(current.activo)
        self.assertTrue(other.activo)
        self.assertFalse(PushSubscription.objects.filter(pk=current_push.pk).exists())
        self.assertTrue(PushSubscription.objects.filter(pk=other_push.pk).exists())
        self.assertFalse(TicketWebSocket.objects.filter(pk=ticket.pk).exists())
        unauthorized = self.client.get(reverse('device-sessions'))
        self.assertEqual(unauthorized.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_closed_session_key_returns_401(self):
        session = self.create_session('closed-device', active=False)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {session.key}')

        response = self.client.get(reverse('device-sessions'))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_websocket_ticket_can_only_be_consumed_once(self):
        from .websocket_auth import consume_websocket_ticket

        session = self.create_session('ticket-device')
        ticket = TicketWebSocket.objects.create(
            sesion=session,
            expira_en=timezone.now() + timedelta(seconds=30),
        )

        self.assertEqual(consume_websocket_ticket(ticket.key), (self.user, session.pk))
        self.assertIsNone(consume_websocket_ticket(ticket.key))


class PushSubscriptionApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='push-user', password='test-password')
        self.other_user = User.objects.create_user(username='other-user', password='test-password')
        self.session = SesionDispositivo.objects.create(
            usuario=self.user,
            dispositivo_id='push-device',
            nombre_dispositivo='Chrome en Android',
            ultimo_uso=timezone.now(),
        )
        self.other_session = SesionDispositivo.objects.create(
            usuario=self.other_user,
            dispositivo_id='other-device',
            nombre_dispositivo='Safari en iOS',
            ultimo_uso=timezone.now(),
        )
        self.client.force_authenticate(self.user, token=self.session)
        self.public_key_url = reverse('push-public-key')
        self.subscriptions_url = reverse('push-subscriptions')
        self.unsubscribe_url = reverse('push-unsubscribe')
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
        self.assertEqual(saved.sesion, self.session)
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
            sesion=self.other_session,
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

        subscription.sesion = self.session
        subscription.save(update_fields=['sesion'])
        response = self.client.delete(
            self.subscriptions_url,
            {'endpoint': self.subscription_data['endpoint']},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(PushSubscription.objects.filter(pk=subscription.pk).exists())

    def test_unsubscribe_endpoint_only_removes_current_users_endpoint(self):
        subscription = PushSubscription.objects.create(
            sesion=self.other_session,
            endpoint=self.subscription_data['endpoint'],
            p256dh='test-p256dh',
            auth='test-auth',
        )
        response = self.client.delete(
            self.unsubscribe_url,
            {'endpoint': self.subscription_data['endpoint']},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertTrue(PushSubscription.objects.filter(pk=subscription.pk).exists())

        subscription.sesion = self.session
        subscription.save(update_fields=['sesion'])
        response = self.client.delete(
            self.unsubscribe_url,
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
        unsubscribe_response = self.client.delete(
            self.unsubscribe_url,
            {'endpoint': self.subscription_data['endpoint']},
            format='json',
        )
        self.assertEqual(get_response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(post_response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(delete_response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(unsubscribe_response.status_code, status.HTTP_401_UNAUTHORIZED)


class PushDeliveryTests(TestCase):
    @override_settings(
        VAPID_PUBLIC_KEY='test-public-key',
        VAPID_PRIVATE_KEY='test-private-key',
        VAPID_ADMIN_EMAIL='test@example.com',
    )
    def test_push_is_sent_to_each_active_session_of_the_recipient(self):
        from .push import send_message_push

        recipient = User.objects.create_user(username='multi-push-parent', password='test-password')
        sender = User.objects.create_user(username='multi-push-staff', password='test-password')
        guardian = Acudiente.objects.create(
            usuario=recipient,
            numero_documento='multi-push-parent',
            nombre_1='Parent',
            apellido_1='Test',
            tipo_documento='CC',
            telefono_1='3000000000',
        )
        conversation = Conversacion.objects.create(acudiente=guardian)
        message = Mensaje.objects.create(conversacion=conversation, remitente=sender, cuerpo='Hola')
        for index in range(2):
            session = SesionDispositivo.objects.create(
                usuario=recipient,
                dispositivo_id=f'multi-push-device-{index}',
                nombre_dispositivo=f'Device {index}',
                ultimo_uso=timezone.now(),
            )
            PushSubscription.objects.create(
                sesion=session,
                endpoint=f'https://push.example.test/multi-device/{index}',
                p256dh='test-p256dh',
                auth='test-auth',
            )

        webpush = Mock()
        push_module = ModuleType('pywebpush')
        push_module.WebPushException = type('WebPushException', (Exception,), {})
        push_module.webpush = webpush
        with patch.dict(sys.modules, {'pywebpush': push_module}):
            sent, failed = send_message_push(message)

        self.assertEqual((sent, failed), (2, 0))
        self.assertEqual(webpush.call_count, 2)


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
        PlantillaMensaje.objects.update_or_create(
            tipo=PlantillaMensaje.RECORDATORIO_CLASE,
            defaults={
                'texto': 'Recordatorio para {alumno} a las {hora} ({jornada}).',
                'activo': True,
            },
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
        session_one = SesionDispositivo.objects.create(
            usuario=self.user,
            dispositivo_id='reminder-device-one',
            nombre_dispositivo='Chrome en Android',
            ultimo_uso=self.now,
        )
        session_two = SesionDispositivo.objects.create(
            usuario=self.user,
            dispositivo_id='reminder-device-two',
            nombre_dispositivo='Safari en iOS',
            ultimo_uso=self.now,
        )
        PushSubscription.objects.create(
            sesion=session_one,
            endpoint='https://push.example.test/subscription/reminder',
            p256dh='test-p256dh',
            auth='test-auth',
        )
        PushSubscription.objects.create(
            sesion=session_two,
            endpoint='https://push.example.test/subscription/reminder-two',
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
        self.assertEqual(webpush.call_count, 2)
