from django.apps import AppConfig


class KraOscuConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'kra_oscu'
    verbose_name = 'KRA OSCU Integration'

    def ready(self):
        """Import signals when Django starts"""
        pass  # No signals module yet
