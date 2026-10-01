from datetime import date

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Alumno, AlumnoClase, Asistencia, Acudiente, ClaseProgramada, Jornada, Pago


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
