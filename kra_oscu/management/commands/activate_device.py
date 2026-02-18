"""
Management command to activate a device with KRA (or mock KRA)
This simulates the KRA device registration process
"""
from django.core.management.base import BaseCommand
from kra_oscu.models import Device, Company
from kra_oscu.services.kra_mock_service import KRAMockService
from kra_oscu.services.kra_client import KRAClient
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Activate a device with KRA eTIMS (registers TIN and initializes device)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--tin',
            type=str,
            help='Company TIN to activate',
        )
        parser.add_argument(
            '--device-serial',
            type=str,
            help='Device serial number to activate',
        )
        parser.add_argument(
            '--all',
            action='store_true',
            help='Activate all pending devices',
        )

    def handle(self, *args, **options):
        tin = options.get('tin')
        device_serial = options.get('device_serial')
        activate_all = options.get('all')

        if activate_all:
            self.activate_all_devices()
        elif tin and device_serial:
            self.activate_specific_device(tin, device_serial)
        elif tin:
            self.activate_company_devices(tin)
        else:
            self.stdout.write(self.style.ERROR(
                'Please provide --tin and --device-serial, --tin only, or use --all'
            ))
            return

    def activate_all_devices(self):
        """Activate all pending devices"""
        devices = Device.objects.filter(status='pending')
        
        if not devices.exists():
            self.stdout.write(self.style.WARNING('No pending devices found'))
            return

        self.stdout.write(f'Found {devices.count()} pending device(s)')
        
        for device in devices:
            self.activate_device(device)

    def activate_company_devices(self, tin):
        """Activate all devices for a specific company"""
        try:
            company = Company.objects.get(tin=tin)
        except Company.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'Company with TIN {tin} not found'))
            return

        devices = Device.objects.filter(company=company, status='pending')
        
        if not devices.exists():
            self.stdout.write(self.style.WARNING(f'No pending devices found for TIN {tin}'))
            return

        self.stdout.write(f'Found {devices.count()} pending device(s) for {company.company_name}')
        
        for device in devices:
            self.activate_device(device)

    def activate_specific_device(self, tin, device_serial):
        """Activate a specific device"""
        try:
            device = Device.objects.get(
                company__tin=tin,
                serial_number=device_serial
            )
        except Device.DoesNotExist:
            self.stdout.write(self.style.ERROR(
                f'Device {device_serial} not found for TIN {tin}'
            ))
            return

        self.activate_device(device)

    def activate_device(self, device):
        """Activate a single device"""
        self.stdout.write(f'\n📱 Activating device: {device.serial_number}')
        self.stdout.write(f'   Company: {device.company.company_name}')
        self.stdout.write(f'   TIN: {device.company.tin}')
        
        try:
            # Step 1: Register TIN with mock KRA
            KRAMockService.register_tin(device.company.tin)
            self.stdout.write(self.style.SUCCESS(
                f'✓ Registered TIN {device.company.tin} with KRA (mock)'
            ))
            
            # Step 2: Initialize device
            kra_client = KRAClient(use_mock=True)
            result = kra_client.init_device(
                tin=device.company.tin,
                bhf_id=device.bhf_id or '000',
                serial_number=device.serial_number,
                device_name=device.device_name or f'Device-{device.serial_number}'
            )
            
            if result['success']:
                # Update device with CMC key
                device.cmc_key = result['cmc_key']
                device.status = 'active'
                device.is_certified = True
                device.save()
                
                # Update company status
                device.company.status = 'active'
                device.company.save()
                
                self.stdout.write(self.style.SUCCESS(
                    f'✓ Device activated successfully'
                ))
                self.stdout.write(f'   CMC Key: {device.cmc_key[:20]}...')
                self.stdout.write(f'   Status: {device.status}')
            else:
                self.stdout.write(self.style.ERROR(
                    f'✗ Device activation failed: {result.get("message")}'
                ))
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(
                f'✗ Error activating device: {str(e)}'
            ))
            logger.error(f'Device activation error: {e}', exc_info=True)

    def display_summary(self):
        """Display summary of device statuses"""
        total_devices = Device.objects.count()
        active_devices = Device.objects.filter(status='active').count()
        pending_devices = Device.objects.filter(status='pending').count()
        
        self.stdout.write('\n' + '='*60)
        self.stdout.write('DEVICE STATUS SUMMARY')
        self.stdout.write('='*60)
        self.stdout.write(f'Total Devices: {total_devices}')
        self.stdout.write(f'Active: {active_devices}')
        self.stdout.write(f'Pending: {pending_devices}')
        self.stdout.write('='*60 + '\n')
