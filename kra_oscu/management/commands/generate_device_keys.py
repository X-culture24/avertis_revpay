"""
Django management command to generate RSA key pairs for KRA eTIMS devices.
Usage: python manage.py generate_device_keys --device-serial DEVICE001
"""

from django.core.management.base import BaseCommand, CommandError
from django.conf import settings
from kra_oscu.models import Device
from kra_oscu.services.crypto_utils import crypto_manager
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Generate RSA key pairs for KRA eTIMS device digital signing'

    def add_arguments(self, parser):
        parser.add_argument(
            '--device-serial',
            type=str,
            help='Device serial number to generate keys for',
        )
        parser.add_argument(
            '--all-devices',
            action='store_true',
            help='Generate keys for all registered devices',
        )
        parser.add_argument(
            '--key-size',
            type=int,
            default=2048,
            help='RSA key size in bits (default: 2048)',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Overwrite existing keys',
        )

    def handle(self, *args, **options):
        device_serial = options['device_serial']
        all_devices = options['all_devices']
        key_size = options['key_size']
        force = options['force']

        if not device_serial and not all_devices:
            raise CommandError('Must specify either --device-serial or --all-devices')

        if device_serial and all_devices:
            raise CommandError('Cannot specify both --device-serial and --all-devices')

        # Validate key size
        if key_size not in [1024, 2048, 4096]:
            raise CommandError('Key size must be 1024, 2048, or 4096 bits')

        if device_serial:
            self.generate_keys_for_device(device_serial, key_size, force)
        else:
            self.generate_keys_for_all_devices(key_size, force)

    def generate_keys_for_device(self, device_serial: str, key_size: int, force: bool):
        """Generate keys for a specific device."""
        try:
            # Check if device exists
            device = Device.objects.filter(serial_number=device_serial).first()
            if not device:
                self.stdout.write(
                    self.style.WARNING(f'Device {device_serial} not found in database')
                )

            # Check if keys already exist
            try:
                crypto_manager.load_keypair_from_files(device_serial)
                if not force:
                    self.stdout.write(
                        self.style.WARNING(
                            f'Keys already exist for device {device_serial}. Use --force to overwrite.'
                        )
                    )
                    return
                else:
                    self.stdout.write(f'Overwriting existing keys for device {device_serial}')
            except FileNotFoundError:
                pass  # Keys don't exist, proceed with generation

            # Generate key pair
            self.stdout.write(f'Generating {key_size}-bit RSA key pair for device {device_serial}...')
            private_key_pem, public_key_pem = crypto_manager.generate_rsa_keypair(key_size)

            # Save keys to files
            private_path, public_path = crypto_manager.save_keypair_to_files(
                private_key_pem, public_key_pem, device_serial
            )

            self.stdout.write(
                self.style.SUCCESS(
                    f'Successfully generated keys for device {device_serial}:\n'
                    f'  Private key: {private_path}\n'
                    f'  Public key: {public_path}'
                )
            )

            # Display public key for KRA registration
            self.stdout.write('\n' + '='*60)
            self.stdout.write('PUBLIC KEY FOR KRA REGISTRATION:')
            self.stdout.write('='*60)
            self.stdout.write(public_key_pem.decode('utf-8'))
            self.stdout.write('='*60)
            self.stdout.write(
                self.style.WARNING(
                    'IMPORTANT: Register this public key with KRA during device initialization!'
                )
            )

        except Exception as e:
            raise CommandError(f'Failed to generate keys for device {device_serial}: {e}')

    def generate_keys_for_all_devices(self, key_size: int, force: bool):
        """Generate keys for all registered devices."""
        devices = Device.objects.all()
        
        if not devices.exists():
            self.stdout.write(self.style.WARNING('No devices found in database'))
            return

        self.stdout.write(f'Found {devices.count()} devices')
        
        for device in devices:
            self.stdout.write(f'\nProcessing device: {device.serial_number}')
            try:
                self.generate_keys_for_device(device.serial_number, key_size, force)
            except CommandError as e:
                self.stdout.write(self.style.ERROR(f'Failed for {device.serial_number}: {e}'))
                continue

        self.stdout.write(
            self.style.SUCCESS(f'\nCompleted key generation for all devices')
        )
