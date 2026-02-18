"""
Receipt formatting and generation service for KRA-compliant invoices.
Generates mobile-friendly receipt data and printable formats.
"""
import qrcode
import io
import base64
from decimal import Decimal
from django.utils import timezone
from typing import Dict, Any


class ReceiptService:
    """Service for formatting and generating invoice receipts"""
    
    @staticmethod
    def format_receipt_for_mobile(invoice) -> Dict[str, Any]:
        """
        Format invoice data for mobile app display
        Matches the format shown in the mobile receipt image
        """
        # Get company and device details
        company = invoice.company
        device = invoice.device
        
        # Calculate tax breakdown by tax type
        tax_breakdown = ReceiptService._calculate_tax_breakdown(invoice)
        
        # Format receipt data
        receipt_data = {
            # Store Information Section
            "store_information": {
                "name": company.company_name,
                "address": company.business_address,
                "tin": company.tin,
                "phone": company.contact_phone,
                "email": company.contact_email
            },
            
            # Transaction Section
            "transaction": {
                "date": invoice.transaction_date.strftime("%a, %d %b %Y, %H:%M:%S"),
                "invoice_no": invoice.invoice_no,
                "receipt_no": invoice.receipt_no or "Pending",
                "payment_type": invoice.get_payment_type_display(),
                "currency": invoice.currency,
                "status": invoice.status
            },
            
            # Tax Information Section
            "tax_information": {
                "taxable_amount": float(invoice.total_amount - invoice.tax_amount),
                "tax_rate_a": float(tax_breakdown.get('A', 0)),  # 16% VAT
                "tax_rate_b": float(tax_breakdown.get('B', 0)),  # 8% VAT
                "tax_rate_c": float(tax_breakdown.get('C', 0)),  # 0% VAT
                "tax_rate_d": float(tax_breakdown.get('D', 0)),  # Exempt
                "total_tax": float(invoice.tax_amount),
                "total_amount": float(invoice.total_amount)
            },
            
            # Payment Section
            "payment": {
                "method": invoice.get_payment_type_display(),
                "amount": float(invoice.total_amount)
            },
            
            # SCU Information Section (KRA Device Details)
            "scu_information": {
                "device_serial": device.serial_number,
                "device_type": device.get_device_type_display(),
                "internal_data": invoice.internal_data or "Pending KRA approval",
                "receipt_signature": invoice.receipt_signature or "Pending",
                "qr_code": invoice.qr_code_data or ""
            },
            
            # Invoice Information Section
            "invoice_information": {
                "invoice_no": invoice.invoice_no,
                "receipt_no": invoice.receipt_no or "Pending",
                "issue_date": invoice.created_at.strftime("%a, %d %b %Y, %H:%M:%S"),
                "transaction_date": invoice.transaction_date.strftime("%a, %d %b %Y, %H:%M:%S")
            },
            
            # Items Section
            "items": [
                {
                    "description": item.item_name,
                    "item_code": item.item_code,
                    "quantity": float(item.quantity),
                    "unit_price": float(item.unit_price),
                    "tax_type": item.tax_type,
                    "tax_rate": float(item.tax_rate),
                    "tax_amount": float(item.tax_amount),
                    "total_amount": float(item.total_price + item.tax_amount),
                    "unit_of_measure": item.unit_of_measure
                }
                for item in invoice.items.all()
            ],
            
            # Customer Information
            "customer": {
                "name": invoice.customer_name or "Walk-in Customer",
                "tin": invoice.customer_tin or "N/A"
            },
            
            # QR Code (base64 encoded image)
            "qr_code_image": ReceiptService._generate_qr_code_image(invoice),
            
            # Footer Information
            "footer": {
                "company_name": "©2025 Revpay Connect Ltd, a limited liability company. All rights reserved",
                "compliance_text": "This is a computer generated invoice. No signature is necessary.",
                "website": "revpay.co.ke",
                "support_email": "support@revpay.co.ke",
                "support_phone": "+254 700 000 000"
            }
        }
        
        return receipt_data
    
    @staticmethod
    def format_receipt_for_print(invoice) -> Dict[str, Any]:
        """
        Format invoice data for PDF/print view
        Matches the ONETIMS format shown in the print receipt image
        """
        company = invoice.company
        device = invoice.device
        
        # Calculate tax breakdown
        tax_breakdown = ReceiptService._calculate_tax_breakdown(invoice)
        
        # Format for print (ONETIMS style)
        receipt_data = {
            # Header
            "header": {
                "brand": "ONETIMS",
                "etr_number": invoice.receipt_no or "Pending Approval"
            },
            
            # Issued To (Customer)
            "issued_to": {
                "name": invoice.customer_name or "Walk-in Customer",
                "address": "N/A",
                "phone": "N/A",
                "tin": invoice.customer_tin or "N/A"
            },
            
            # Payable To (Business)
            "payable_to": {
                "name": company.company_name,
                "tin": company.tin,
                "phone": company.contact_phone,
                "bank": "N/A",  # Add bank details if available
                "address": company.business_address
            },
            
            # Transaction Details
            "transaction": {
                "bill_to": invoice.customer_tin or "N/A",
                "date_issued": invoice.created_at.strftime("%d, %b, %Y"),
                "date_due": invoice.transaction_date.strftime("%d %b, %y"),
                "address": company.business_address,
                "project": "Product mobile sales"  # Can be customized
            },
            
            # Items Table
            "items": [
                {
                    "description": item.item_name,
                    "quantity": float(item.quantity),
                    "unit_price": float(item.unit_price),
                    "tax_rate": float(item.tax_rate),
                    "amount": float(item.total_price + item.tax_amount)
                }
                for item in invoice.items.all()
            ],
            
            # Totals
            "totals": {
                "subtotal": float(invoice.total_amount - invoice.tax_amount),
                "tax": float(invoice.tax_amount),
                "total": float(invoice.total_amount)
            },
            
            # Footer
            "footer": {
                "compliance_text": "This is a computer generated invoice. No signature is necessary",
                "phone": company.contact_phone,
                "email": company.contact_email,
                "website": "revpay.co.ke"
            },
            
            # QR Code
            "qr_code_image": ReceiptService._generate_qr_code_image(invoice)
        }
        
        return receipt_data
    
    @staticmethod
    def _calculate_tax_breakdown(invoice) -> Dict[str, Decimal]:
        """Calculate tax amounts by tax type"""
        tax_breakdown = {}
        
        for item in invoice.items.all():
            tax_type = item.tax_type
            if tax_type not in tax_breakdown:
                tax_breakdown[tax_type] = Decimal('0.00')
            tax_breakdown[tax_type] += item.tax_amount
        
        return tax_breakdown
    
    @staticmethod
    def _generate_qr_code_image(invoice) -> str:
        """
        Generate QR code image as base64 string
        QR code contains invoice verification data
        """
        if not invoice.qr_code_data:
            # Generate QR code data if not exists
            qr_data = ReceiptService._generate_qr_data(invoice)
        else:
            qr_data = invoice.qr_code_data
        
        # Generate QR code
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(qr_data)
        qr.make(fit=True)
        
        # Create image
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Convert to base64
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        img_str = base64.b64encode(buffer.getvalue()).decode()
        
        return f"data:image/png;base64,{img_str}"
    
    @staticmethod
    def _generate_qr_data(invoice) -> str:
        """
        Generate QR code data for invoice verification
        Format: TIN|InvoiceNo|Date|Amount|ReceiptNo
        """
        qr_data = (
            f"{invoice.tin}|"
            f"{invoice.invoice_no}|"
            f"{invoice.transaction_date.strftime('%Y%m%d')}|"
            f"{invoice.total_amount}|"
            f"{invoice.receipt_no or 'PENDING'}"
        )
        return qr_data
    
    @staticmethod
    def generate_receipt_html(invoice, format_type='mobile') -> str:
        """
        Generate HTML receipt for printing or email
        
        Args:
            invoice: Invoice object
            format_type: 'mobile' or 'print'
        
        Returns:
            HTML string
        """
        if format_type == 'mobile':
            receipt_data = ReceiptService.format_receipt_for_mobile(invoice)
            return ReceiptService._render_mobile_html(receipt_data)
        else:
            receipt_data = ReceiptService.format_receipt_for_print(invoice)
            return ReceiptService._render_print_html(receipt_data)
    
    @staticmethod
    def _render_mobile_html(receipt_data: Dict[str, Any]) -> str:
        """Render mobile-style HTML receipt"""
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Receipt - {receipt_data['transaction']['invoice_no']}</title>
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    max-width: 400px;
                    margin: 0 auto;
                    padding: 20px;
                    background: #f5f5f5;
                }}
                .receipt {{
                    background: white;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }}
                .section {{
                    margin-bottom: 20px;
                    padding-bottom: 15px;
                    border-bottom: 1px solid #eee;
                }}
                .section:last-child {{
                    border-bottom: none;
                }}
                .section-title {{
                    font-weight: bold;
                    font-size: 14px;
                    color: #333;
                    margin-bottom: 10px;
                }}
                .row {{
                    display: flex;
                    justify-content: space-between;
                    margin: 5px 0;
                    font-size: 13px;
                }}
                .label {{
                    color: #666;
                }}
                .value {{
                    color: #000;
                    font-weight: 500;
                }}
                .total {{
                    font-size: 16px;
                    font-weight: bold;
                    color: #000;
                }}
                .qr-code {{
                    text-align: center;
                    margin: 20px 0;
                }}
                .qr-code img {{
                    max-width: 200px;
                }}
                .footer {{
                    text-align: center;
                    font-size: 11px;
                    color: #666;
                    margin-top: 20px;
                }}
            </style>
        </head>
        <body>
            <div class="receipt">
                <!-- Store Information -->
                <div class="section">
                    <div class="section-title">Store Information</div>
                    <div class="row">
                        <span class="label">Name:</span>
                        <span class="value">{receipt_data['store_information']['name']}</span>
                    </div>
                    <div class="row">
                        <span class="label">Address:</span>
                        <span class="value">{receipt_data['store_information']['address']}</span>
                    </div>
                    <div class="row">
                        <span class="label">TIN:</span>
                        <span class="value">{receipt_data['store_information']['tin']}</span>
                    </div>
                    <div class="row">
                        <span class="label">Phone:</span>
                        <span class="value">{receipt_data['store_information']['phone']}</span>
                    </div>
                </div>
                
                <!-- Transaction -->
                <div class="section">
                    <div class="section-title">Transaction</div>
                    <div class="row">
                        <span class="label">Date:</span>
                        <span class="value">{receipt_data['transaction']['date']}</span>
                    </div>
                    <div class="row">
                        <span class="label">Invoice No:</span>
                        <span class="value">{receipt_data['transaction']['invoice_no']}</span>
                    </div>
                    <div class="row">
                        <span class="label">Receipt No:</span>
                        <span class="value">{receipt_data['transaction']['receipt_no']}</span>
                    </div>
                    <div class="row">
                        <span class="label">Payment:</span>
                        <span class="value">{receipt_data['transaction']['payment_type']}</span>
                    </div>
                </div>
                
                <!-- Tax Information -->
                <div class="section">
                    <div class="section-title">Tax Information</div>
                    <div class="row">
                        <span class="label">Taxable Amount:</span>
                        <span class="value">{receipt_data['transaction']['currency']} {receipt_data['tax_information']['taxable_amount']:.2f}</span>
                    </div>
                    <div class="row">
                        <span class="label">Total Tax:</span>
                        <span class="value">{receipt_data['transaction']['currency']} {receipt_data['tax_information']['total_tax']:.2f}</span>
                    </div>
                    <div class="row total">
                        <span class="label">Total Amount:</span>
                        <span class="value">{receipt_data['transaction']['currency']} {receipt_data['tax_information']['total_amount']:.2f}</span>
                    </div>
                </div>
                
                <!-- QR Code -->
                <div class="qr-code">
                    <img src="{receipt_data['qr_code_image']}" alt="QR Code">
                </div>
                
                <!-- Footer -->
                <div class="footer">
                    <p>{receipt_data['footer']['compliance_text']}</p>
                    <p>{receipt_data['footer']['company_name']}</p>
                </div>
            </div>
        </body>
        </html>
        """
        return html
    
    @staticmethod
    def _render_print_html(receipt_data: Dict[str, Any]) -> str:
        """Render print-style HTML receipt (ONETIMS format)"""
        items_html = ""
        for item in receipt_data['items']:
            items_html += f"""
            <tr>
                <td>{item['description']}</td>
                <td style="text-align: center;">{item['quantity']}</td>
                <td style="text-align: right;">{item['unit_price']:.2f}</td>
                <td style="text-align: right;">{item['amount']:.2f}</td>
            </tr>
            """
        
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Receipt - {receipt_data['header']['etr_number']}</title>
            <style>
                @page {{
                    size: A4;
                    margin: 20mm;
                }}
                body {{
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 20px;
                    font-size: 12px;
                }}
                .header {{
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 30px;
                }}
                .brand {{
                    font-size: 32px;
                    font-weight: bold;
                }}
                .etr-number {{
                    text-align: right;
                }}
                .two-column {{
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 30px;
                }}
                .column {{
                    width: 48%;
                }}
                .section-title {{
                    font-weight: bold;
                    margin-bottom: 10px;
                    padding-bottom: 5px;
                    border-bottom: 2px solid #000;
                }}
                .info-row {{
                    margin: 5px 0;
                }}
                table {{
                    width: 100%;
                    border-collapse: collapse;
                    margin: 20px 0;
                }}
                th {{
                    background: #f0f0f0;
                    padding: 10px;
                    text-align: left;
                    border-bottom: 2px solid #000;
                }}
                td {{
                    padding: 8px;
                    border-bottom: 1px solid #ddd;
                }}
                .totals {{
                    text-align: right;
                    margin-top: 20px;
                }}
                .totals .row {{
                    margin: 5px 0;
                }}
                .totals .total {{
                    font-size: 16px;
                    font-weight: bold;
                }}
                .footer {{
                    margin-top: 40px;
                    text-align: center;
                    font-size: 11px;
                    color: #666;
                }}
                .qr-code {{
                    text-align: center;
                    margin: 20px 0;
                }}
            </style>
        </head>
        <body>
            <!-- Header -->
            <div class="header">
                <div class="brand">ONETIMS</div>
                <div class="etr-number">
                    <strong>ETR NUMBER</strong><br>
                    #{receipt_data['header']['etr_number']}
                </div>
            </div>
            
            <!-- Two Column Layout -->
            <div class="two-column">
                <!-- Issued To -->
                <div class="column">
                    <div class="section-title">Issued to</div>
                    <div class="info-row"><strong>NAME AND ADDRESS:</strong> {receipt_data['issued_to']['name']}</div>
                    <div class="info-row"><strong>PIN NUMBER:</strong> {receipt_data['issued_to']['tin']}</div>
                </div>
                
                <!-- Payable To -->
                <div class="column">
                    <div class="section-title">Payable to</div>
                    <div class="info-row"><strong>A/C NAME:</strong> {receipt_data['payable_to']['name']}</div>
                    <div class="info-row"><strong>A/C NUMBER:</strong> {receipt_data['payable_to']['tin']}</div>
                    <div class="info-row"><strong>PIN NUMBER:</strong> {receipt_data['payable_to']['tin']}</div>
                    <div class="info-row"><strong>BANK:</strong> {receipt_data['payable_to']['bank']}</div>
                </div>
            </div>
            
            <!-- Transaction Details -->
            <div style="margin-bottom: 20px;">
                <div class="info-row"><strong>BILL TO:</strong> {receipt_data['transaction']['bill_to']}</div>
                <div class="info-row"><strong>DATE ISSUED:</strong> {receipt_data['transaction']['date_issued']}</div>
                <div class="info-row"><strong>DATE DUE:</strong> {receipt_data['transaction']['date_due']}</div>
                <div class="info-row"><strong>ADDRESS:</strong> {receipt_data['transaction']['address']}</div>
            </div>
            
            <!-- Items Table -->
            <table>
                <thead>
                    <tr>
                        <th>DESCRIPTION</th>
                        <th style="text-align: center;">QTY</th>
                        <th style="text-align: right;">UNIT PRICE</th>
                        <th style="text-align: right;">AMOUNT</th>
                    </tr>
                </thead>
                <tbody>
                    {items_html}
                </tbody>
            </table>
            
            <!-- Totals -->
            <div class="totals">
                <div class="row">Subtotal: {receipt_data['totals']['subtotal']:.2f}</div>
                <div class="row">Tax: {receipt_data['totals']['tax']:.2f}</div>
                <div class="row total">Total: {receipt_data['totals']['total']:.2f}</div>
            </div>
            
            <!-- QR Code -->
            <div class="qr-code">
                <img src="{receipt_data['qr_code_image']}" alt="QR Code" style="max-width: 150px;">
            </div>
            
            <!-- Footer -->
            <div class="footer">
                <p>{receipt_data['footer']['compliance_text']}</p>
                <p>PHONE: {receipt_data['footer']['phone']} | EMAIL: {receipt_data['footer']['email']} | WEBSITE: {receipt_data['footer']['website']}</p>
            </div>
        </body>
        </html>
        """
        return html

