from django.apps import AppConfig
import os
import sys
from threading import Thread


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'

    def ready(self):
        # runserver starts a parent process for autoreload. Start the loop only
        # in the serving child (or directly when autoreload is disabled).
        if 'runserver' not in sys.argv:
            return
        reloader_child = os.environ.get('RUN_MAIN') == 'true'
        no_reloader = '--noreload' in sys.argv
        if reloader_child or no_reloader:
            from .tasks import ejecutar_recordatorios_periodicos

            Thread(
                target=ejecutar_recordatorios_periodicos,
                name='recordatorios-automaticos',
                daemon=True,
            ).start()
