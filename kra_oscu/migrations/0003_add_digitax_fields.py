# Generated migration for DigiTax integration fields

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('kra_oscu', '0002_invoice_is_copy_invoice_original_receipt_no_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='invoice',
            name='digitax_id',
            field=models.CharField(blank=True, help_text='DigiTax transaction ID', max_length=100, null=True),
        ),
        migrations.AddField(
            model_name='invoice',
            name='error_message',
            field=models.TextField(blank=True, help_text='Error message from KRA submission', null=True),
        ),
        migrations.AddField(
            model_name='invoice',
            name='etims_url',
            field=models.URLField(blank=True, help_text='KRA eTIMS verification URL', null=True),
        ),
        migrations.AddField(
            model_name='invoice',
            name='synced_at',
            field=models.DateTimeField(blank=True, help_text='Timestamp when synced to KRA', null=True),
        ),
    ]
