"""
Management command to sync pending invoices with KRA
"""
from django.core.management.base import BaseCommand
from kra_oscu.models import Invoice
from kra_oscu.services.kra_client import KRAClient
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Sync pending invoices with KRA eTIMS'

    def add_arguments(self, parser):
        parser.add_argument(
            '--invoice-id',
            type=str,
            help='Specific invoice ID to sync',
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=50,
            help='Maximum number of invoices to sync (default: 50)',
        )

    def handle(self, *args, **options):
        invoice_id = options.get('invoice_id')
        limit = options.get('limit')

        if invoice_id:
            self.sync_specific_invoice(invoice_id)
        else:
            self.sync_pending_invoices(limit)

    def sync_specific_invoice(self, invoice_id):
        """Sync a specific invoice"""
        try:
            invoice = Invoice.objects.get(id=invoice_id)
        except Invoice.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'Invoice {invoice_id} not found'))
            return

        self.stdout.write(f'\n📄 Syncing invoice: {invoice.invoice_no}')
        self.sync_invoice(invoice)

    def sync_pending_invoices(self, limit):
        """Sync all pending invoices"""
        invoices = Invoice.objects.filter(status='pending').order_by('created_at')[:limit]
        
        if not invoices.exists():
            self.stdout.write(self.style.WARNING('No pending invoices found'))
            return

        self.stdout.write(f'\nFound {invoices.count()} pending invoice(s)')
        
        success_count = 0
        fail_count = 0
        
        for invoice in invoices:
            self.stdout.write(f'\n📄 Processing: {invoice.invoice_no}')
            
            if self.sync_invoice(invoice):
                success_count += 1
            else:
                fail_count += 1
        
        # Print summary
        self.stdout.write('\n' + '='*60)
        self.stdout.write('SYNC SUMMARY')
        self.stdout.write('='*60)
        self.stdout.write(f'Total Processed: {success_count + fail_count}')
        self.stdout.write(self.style.SUCCESS(f'Successful: {success_count}'))
        if fail_count > 0:
            self.stdout.write(self.style.ERROR(f'Failed: {fail_count}'))
        self.stdout.write('='*60 + '\n')

    def sync_invoice(self, invoice):
        """Sync a single invoice with KRA"""
        try:
            # Check if device is active
            if not invoice.device or invoice.device.status != 'active':
                self.stdout.write(self.style.ERROR(
                    f'✗ Device not active for invoice {invoice.invoice_no}'
                ))
                return False
            
            # Initialize KRA client
            kra_client = KRAClient(use_mock=True)
            
            # Send invoice to KRA
            result = kra_client.send_sales_invoice(invoice)
            
            if result['success']:
                # Update invoice with KRA response
                invoice.status = 'approved'
                invoice.receipt_no = result.get('receipt_no')
                invoice.receipt_signature = result.get('receipt_signature')
                invoice.internal_data = result.get('internal_data')
                invoice.qr_code_data = result.get('qr_code', '')
                invoice.save()
                
                self.stdout.write(self.style.SUCCESS(
                    f'✓ Invoice approved: {invoice.invoice_no}'
                ))
                self.stdout.write(f'   Receipt No: {invoice.receipt_no}')
                self.stdout.write(f'   Signature: {invoice.receipt_signature[:32]}...')
                
                return True
            else:
                # Update invoice status to failed
                invoice.status = 'failed'
                invoice.error_message = result.get('error_message', 'Unknown error')
                invoice.save()
                
                self.stdout.write(self.style.ERROR(
                    f'✗ Invoice failed: {invoice.invoice_no}'
                ))
                self.stdout.write(f'   Error: {invoice.error_message}')
                
                return False
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(
                f'✗ Error syncing invoice: {str(e)}'
            ))
            logger.error(f'Invoice sync error: {e}', exc_info=True)
            return False
